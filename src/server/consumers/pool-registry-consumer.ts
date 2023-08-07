import { ContractRunner } from 'ethers';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { sleep } from '../../libs/sleep';
import { PairMetadata } from '../producers/types';
import { PoolRegistryProducer } from '../producers/pool-registry-producer';

const stableCoinSymbols = [
  'USDC', 'USDT', 'DAI', 'USDR', 'BUSD', 'FRAX', 'NUSD',
  'MUSD', 'CASH', 'BOB', 'TUSD', 'USX', 'USD+', 'MIM',
  'DUSD', 'DOLA', 'USDK', 'NXUSD', 'LUSD', 'MAI',
];

export class PoolRegistryConsumer {
  provider: ContractRunner;
  existingPoolAddresses: Set<string> = new Set();
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;
  pairs = new Map<string, PairMetadata>();
  stablePairs: Set<PairMetadata> = new Set();

  listeners = new Map<string, (pairs: PairMetadata[]) => void>();

  async initialize(): Promise<void> {
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY],
      fromBeginning: true,
    }, {
      groupId: uuid(),
    });
    this.initialized = true;
  }

  has(address: string): boolean {
    return this.existingPoolAddresses.has(address);
  }

  get sortedPairs(): PairMetadata[] {
    return Array.of(...this.pairs.values())
      .sort((a, b) => a.token0.symbol.localeCompare(b.token0.symbol));
  }

  static isStableToken(symbol: string): boolean {
    return stableCoinSymbols.includes(symbol);
  }

  static isStablePairOrNull(pair: PairMetadata | null): boolean {
    if (pair === null) {
      return true
    }
    return PoolRegistryConsumer.isStableToken(pair.token0.symbol)
      || PoolRegistryConsumer.isStableToken(pair.token1.symbol);
  }

  fetchStablePairConnection(pair: PairMetadata): PairMetadata | null {
    for (const stablePair of this.stablePairs.values()) {
      if (stablePair.token0.symbol === pair.token0.symbol ||
        stablePair.token1.symbol === pair.token1.symbol) {
        return stablePair;
      }
    }
    return null;
  }

  getRelatedPair(pair: PairMetadata): PairMetadata | null {
    // So, this does not account for multiple paths, nor path length.
    // This entire thing can be improved by using a shortest path algorithm
    // on a price node graph, buuuuut, not now.
    for (const otherPair of this.pairs.values()) {
      if (otherPair.token0.symbol === pair.token0.symbol
        || otherPair.token0.symbol === pair.token1.symbol
        || otherPair.token1.symbol === pair.token0.symbol
        || otherPair.token1.symbol === pair.token1.symbol) {
        return otherPair;
      }
    }
    return null;
  }

  findPathToStablePair(pair: PairMetadata, connections: PairMetadata[] = [], maxLevels = 5): PairMetadata[] | null {
    if (PoolRegistryConsumer.isStablePairOrNull(pair)) {
      return null;
    }
    if (connections.filter(PoolRegistryConsumer.isStablePairOrNull).length > 0) {
      return connections;
    }
    // We've gone past 5 levels, it probably doesn't exist or we don't care about it enough to look.
    if (maxLevels === 0) {
      return null;
    }
    const stablePairConnection = this.fetchStablePairConnection(pair);
    if (stablePairConnection !== null) {
      return [pair, ...connections, stablePairConnection];
    }
    const relatedPair = this.getRelatedPair(pair);
    if (relatedPair !== null) {
      return this.findPathToStablePair(relatedPair, connections, maxLevels - 1);
    }
    return null;
  }

  async getPairMetadata(address: string): Promise<PairMetadata | undefined> {
    let maxRepetitions = 10; // 100 * 10 = 1_000ms
    while (this.pairs.get(address) === undefined && maxRepetitions > 1) {
      maxRepetitions -= 1;
      await sleep(100);
    }
    return this.pairs.get(address);
  }

  getPairBySymbol(symbol: string): PairMetadata | null {
    for (const pair of this.pairs.values()) {
      if (PoolRegistryProducer.normalizedPairString(pair) === symbol) {
        return pair;
      }
    }
    return null;
  }

  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.consumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        const pair: PairMetadata = JSON.parse(message.value.toString());
        this.pairs.set(pair.pair, pair);
        if (PoolRegistryConsumer.isStablePairOrNull(pair)) {
          this.stablePairs.add(pair);
        }
        this.existingPoolAddresses.add(pair.pair);
        this.listeners.forEach((callback) => {
          callback(this.sortedPairs);
        });
      },
    });
  }

}
