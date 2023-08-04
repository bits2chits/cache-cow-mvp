import { PoolRegistryConsumer } from '../pool-registry/pool-registry-consumer';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { v4 as uuid } from 'uuid';
import { CalculatedReserves } from '../../events/blockchain/types';
import { MultiPoolPricesMap, PricesMap } from './types';
import { Sync } from '../../events/blockchain/sync';
import { PairMetadata } from '../pool-registry/types';
import { Decimal } from 'decimal.js';
import { PoolRegistryProducer } from '../pool-registry/pool-registry-producer';

export class PriceAggregateProcessor {
  registry: PoolRegistryConsumer;
  admin: KafkaAdmin;
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;
  multiPoolPrices: MultiPoolPricesMap = {};
  prices: PricesMap = {};
  listeners = new Map<string, (pairs: PricesMap) => void>();

  constructor(registry: PoolRegistryConsumer) {
    this.registry = registry;
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    const topics = (await this.admin.listTopics()).filter((topic) => !topic.startsWith('__') && !topic.includes('.'));
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics,
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

  calculateAveragePrice(pairSymbol: string, pair: PairMetadata): CalculatedReserves {
    const prices = this.multiPoolPrices[pairSymbol];
    const token0ReservesSum = Decimal.sum(...Object.values(prices).map((it) => it.reserve0));
    const token1ReservesSum = Decimal.sum(...Object.values(prices).map((it) => it.reserve1));
    const token0Result = token0ReservesSum.div(token1ReservesSum).toSignificantDigits(5, Decimal.ROUND_HALF_UP);
    const token1Result = token1ReservesSum.div(token0ReservesSum).toSignificantDigits(5, Decimal.ROUND_HALF_UP);
    return {
      key: pairSymbol,
      token0: pair.token0.symbol,
      token1: pair.token1.symbol,
      token0Price: token0Result.toString(),
      token1Price: token1Result.toString(),
      reserve0: token0ReservesSum.toString(),
      reserve1: token1ReservesSum.toString(),
      poolSize: Object.keys(prices).length,
      updated: new Date()
    };
  }

  updatePriceState(price: CalculatedReserves): void {
    this.prices[price.key] = price
  }

  registerListener(id: string, callback: (prices: PricesMap) => void): void {
    this.listeners.set(id, callback);
  }

  async broadcastPriceUpdates(): Promise<void> {
    if (this.listeners.size > 0) {
      this.listeners.forEach((callback) => callback(this.prices));
    }
  }

  async processPairReserves(reserves: CalculatedReserves, pair: PairMetadata): Promise<void> {
    const pairSymbol = PoolRegistryProducer.normalizedPairString(pair);
    this.updateMultipoolPriceState(pairSymbol, reserves, pair);
    const calculatedAverage = this.calculateAveragePrice(pairSymbol, pair);
    this.updatePriceState(calculatedAverage);
    console.log(`Updating average price for pair ${pairSymbol}. Token0: ${calculatedAverage.token0Price} - Token1: ${calculatedAverage.token1Price}`);
    await Promise.all([
      this.producer.send({
        topic: `prices.${pairSymbol}`,
        messages: [{
          key: calculatedAverage.key,
          value: JSON.stringify(calculatedAverage),
        }],
      }),
      this.broadcastPriceUpdates()
    ]);
  }


  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.consumer.run({
      eachMessage: async ({ message }) => {
        const reserves: CalculatedReserves = JSON.parse(message.value.toString());
        const address = reserves.key.split(':')[1];
        const pair = this.registry.getPairMetadata(address);
        if (!pair || reserves.token0Price === '0' || reserves.token1Price === '0') {
          return;
        }
        await this.processPairReserves(reserves, pair);
      },
    });
  }
}
