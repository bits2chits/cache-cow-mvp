import { EventFilter } from 'ethers/lib.esm';
import { PoolRegistryConsumer } from '../pool-registry/pool-registry-consumer';
import { KafkaConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { MultiPoolPricesMap, PoolDeltas } from '../block-processor/types';
import { v4 as uuid } from 'uuid';
import { CalculatedReserves } from '../../events/blockchain/types';
import { PairMetadata } from '../pool-registry/types';
import { PoolRegistryProducer } from '../pool-registry/pool-registry-producer';
import { Sync } from '../../events/blockchain/sync';
import { Decimal } from 'decimal.js';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { autoInjectable, container, singleton } from 'tsyringe';

@autoInjectable()
@singleton()
export class MultipoolPriceConsumer {
  filter: EventFilter;
  consumer: KafkaConsumer;
  initialized = false;
  multiPoolPrices: MultiPoolPricesMap = {};
  poolDeltas: { [key: string]: PoolDeltas } = {};
  listeners = new Map<string, (poolDeltas: { [key: string]: PoolDeltas }) => void>();

  constructor(private registry?: PoolRegistryConsumer) {}

  async initialize(): Promise<void> {
    const ConsumerFactory = container.resolve<KafkaConsumerFactory>(KafkaConsumerFactory)
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.LP_POOL_EVENT_LOGS],
      fromBeginning: true,
    }, {
      groupId: uuid(),
    });
    this.initialized = true;
  }

  updateMultipoolPriceState(pairSymbol: string, reserves: CalculatedReserves, pair: PairMetadata): void {
    const token0Decimals = Sync.exponentialDecimals(pair.token0.decimals);
    const token1Decimals = Sync.exponentialDecimals(pair.token1.decimals);
    if (this.multiPoolPrices[pairSymbol]) {
      this.multiPoolPrices[pairSymbol][pair.pair] = {
        key: pairSymbol,
        token0Price: Sync.toSignificant(reserves.token0Price, token0Decimals),
        reserve0: Sync.toSignificant(reserves.reserve0, token0Decimals),
        token1Price: Sync.toSignificant(reserves.token1Price, token1Decimals),
        reserve1: Sync.toSignificant(reserves.reserve1, token1Decimals),
      };
    } else {
      this.multiPoolPrices[pairSymbol] = {};
      this.multiPoolPrices[pairSymbol][pair.pair] = {
        key: pairSymbol,
        token0Price: Sync.toSignificant(reserves.token0Price, token0Decimals),
        reserve0: Sync.toSignificant(reserves.reserve0, token0Decimals),
        token1Price: Sync.toSignificant(reserves.token1Price, token1Decimals),
        reserve1: Sync.toSignificant(reserves.reserve1, token1Decimals),
      };
    }
  }

  calculatePoolDeltas(pools: [address: string, reserves: CalculatedReserves][]): PoolDeltas | null {
    if (pools.length < 2) {
      return null; // If there are less than 2 numbers in the array, return null
    }

    let minimum0 = pools[0];
    let maximum0 = pools[0];

    for (let i = 1; i < pools.length; i++) {
      if (pools[i][1].token0Price < minimum0[1].token0Price) {
        minimum0 = pools[i];
      }
      if (pools[i][1].token0Price > maximum0[1].token0Price) {
        maximum0 = pools[i];
      }
    }
    const hundred = new Decimal(100);
    const delta0 = hundred
      .minus((maximum0[1].token0Price as Decimal)
        .div(minimum0[1].token0Price)
        .mul(hundred))
      .toSignificantDigits(5, Decimal.ROUND_DOWN);

    let minimum1 = pools[0];
    let maximum1 = pools[0];

    for (let i = 1; i < pools.length; i++) {
      if (pools[i][1].token1Price < minimum1[1].token1Price) {
        minimum1 = pools[i];
      }
      if (pools[i][1].token1Price > maximum1[1].token1Price) {
        maximum1 = pools[i];
      }
    }

    const delta1 = hundred
      .minus((maximum0[1].token0Price as Decimal)
        .div(minimum0[1].token0Price)
        .mul(hundred))
      .toSignificantDigits(5, Decimal.ROUND_DOWN);


    return {
      largestDelta0: {
        poolAddress: maximum0[0],
        reserves: maximum0[1],
      },
      largestDelta1: {
        poolAddress: maximum1[0],
        reserves: maximum1[1],
      },
      smallestDelta0: {
        poolAddress: minimum0[0],
        reserves: minimum0[1],
      },
      smallestDelta1: {
        poolAddress: minimum1[0],
        reserves: minimum1[1],
      },
      delta0,
      delta1,
    };
  }

  registerListener(id: string, callback: (poolDeltals: { [key: string]: PoolDeltas }) => void): void {
    this.listeners.set(id, callback);
  }

  broadcastPriceUpdates(): void {
    if (this.listeners.size > 0) {
      this.listeners.forEach((callback) => callback(this.poolDeltas));
    }
  }

  async processPairReserves(reserves: CalculatedReserves, pair: PairMetadata): Promise<void> {
    const pairSymbol = PoolRegistryProducer.normalizedPairString(pair);
    this.updateMultipoolPriceState(pairSymbol, reserves, pair);
    this.poolDeltas[pairSymbol] = this.calculatePoolDeltas(Object.entries(this.multiPoolPrices[pairSymbol]));
    this.broadcastPriceUpdates();
  }

  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.consumer.run({
      eachBatch: async ({ batch }) => {
        const reserves: CalculatedReserves[] = batch.messages.map((message) => JSON.parse(message.value.toString()));
        await Promise.all(reserves.map(async (reserve) => {
          const address = reserve.key.split(':')[0];
          const pair = await this.registry.getPairMetadata(address);
          if (!pair || reserve.token0Price === '0' || reserve.token1Price === '0') {
            return Promise.resolve();
          }
          return this.processPairReserves(reserve, pair);
        }));
      },
    });
  }
}
