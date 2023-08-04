import { ContractRunner } from 'ethers';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { PairMetadata } from './types';

export class PoolRegistryConsumer {
  provider: ContractRunner;
  admin: KafkaAdmin;
  existingPoolAddresses: Set<string>;
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;
  pairs = new Map<string, PairMetadata>();
  listeners = new Map<string, (pairs: PairMetadata[]) => void>();

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    const topics: string[] = (await this.admin.listTopics());
    this.existingPoolAddresses = new Set(topics.filter((topic) => !topic.startsWith('__') && !topic.includes('.')));
    if (!topics.includes(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY)) {
      console.log(`Creating system event topic: ${SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY}`);
      await this.admin.createTopic(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY);
    }
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

  getPairMetadata(address: string): PairMetadata | undefined {
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
