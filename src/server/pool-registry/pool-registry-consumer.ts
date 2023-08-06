import { ContractRunner } from 'ethers';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { PairMetadata } from './types';
import { sleep } from '../../libs/sleep';

export class PoolRegistryConsumer {
  provider: ContractRunner;
  existingPoolAddresses: Set<string> = new Set();
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;
  pairs = new Map<string, PairMetadata>();
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

  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.consumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        const pair: PairMetadata = JSON.parse(message.value.toString());
        this.pairs.set(pair.pair, pair);
        this.existingPoolAddresses.add(pair.pair);
        this.listeners.forEach((callback) => {
          callback(this.sortedPairs);
        });
      },
    });
  }

  async getPairMetadata(address: string): Promise<PairMetadata | undefined> {
    let maxRepetitions = 10 // 100 * 10 = 1_000ms
    while(this.pairs.get(address) === undefined && maxRepetitions > 1) {
      maxRepetitions -= 1
      await sleep(100);
    }
    return this.pairs.get(address);
  }

  has(address: string): boolean {
    return this.existingPoolAddresses.has(address);
  }

  get sortedPairs(): PairMetadata[] {
    return Array.of(...this.pairs.values())
      .sort((a, b) => a.token0.symbol.localeCompare(b.token0.symbol));
  }

  registerListener(id: string, callback: (pairs: PairMetadata[]) => void): void {
    this.listeners.set(id, callback);
  }

  static formatPairName(pair: PairMetadata): string {
    return `${pair.token0.symbol} → ${pair.token1.symbol}`
  }

}
