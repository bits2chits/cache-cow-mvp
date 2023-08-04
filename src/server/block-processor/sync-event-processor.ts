import { ethers, EventFilter, Interface, JsonRpcProvider, Log } from 'ethers';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import UniswapV2Abi from '../../abis/uniswap-v2.json';
import { Sync } from '../../events/blockchain/sync';
import { PoolRegistryConsumer } from '../pool-registry/pool-registry-consumer';
import { CompressionTypes, ProducerRecord, RecordMetadata } from 'kafkajs';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { sleep } from '../../libs/sleep';

export class SyncEventProcessor {
  provider: JsonRpcProvider;
  registry: PoolRegistryConsumer;
  uniswapV2Interface: Interface;
  eventSignature: string;
  filter: EventFilter;
  admin: KafkaAdmin;
  producer: KafkaProducer;
  poolAddedOutboxInterval: NodeJS.Timer;
  messageOutboxInterval: NodeJS.Timer;
  initialized = false;
  poolAddedOutbox: Map<string, Log> = new Map();
  messageOutbox: ProducerRecord[] = [];
  shuttingDown = false;

  constructor(provider: JsonRpcProvider, registry: PoolRegistryConsumer) {
    this.provider = provider;
    this.registry = registry;
    this.uniswapV2Interface = new ethers.Interface(UniswapV2Abi);
    this.eventSignature = 'Sync(uint112,uint112)';
    this.filter = {
      address: null,
      topics: [ethers.id(this.eventSignature)],
    };
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    this.producer = await ProducerFactory.getProducer();
    this.poolAddedOutboxInterval = setInterval(async () => await this.processPoolAdded(), 1000);
    this.messageOutboxInterval = setInterval(async () => await this.processMessages(), 100);
    this.initialized = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processLog(log: any): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    const parsedLog = this.uniswapV2Interface.parseLog(log);
    const event = new Sync(log.address, this.registry.getPairMetadata(log.address), parsedLog);
    this.poolAddedOutbox.set(log.address, log);
    this.messageOutbox.push({
      topic: log.address,
      messages: [{
        key: event.get('key'),
        value: JSON.stringify(event),
      }],
    });
  }

  async processMessages(): Promise<void> {
    const batch = [];
    for (let i = 0; i < this.messageOutbox.length; i++) {
      if (this.registry.has(this.messageOutbox[i].topic)) {
        batch.push(this.messageOutbox.shift());
      } else {
        console.info(`Skipping message ${i + 1}. Awaiting creation of topic: ${this.messageOutbox[i].topic}`);
      }
    }
    try {
      await this.producer.sendBatch({
        topicMessages: batch,
        compression: CompressionTypes.Snappy,
      });
    } catch (e) {
      console.error('Could not process batch', e);
      this.messageOutbox.push(...batch);
    }
  }

  async processPoolAdded(): Promise<[void, RecordMetadata[]]> {
    const batch = [];
    const addresses = [];
    for (const [address, log] of this.poolAddedOutbox) {
      addresses.push(address);
      if (!this.registry.has(address)) {
        batch.push({
          topic: SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED,
          messages: [{
            key: log.address,
            value: JSON.stringify(log, (_, value) =>
              typeof value === 'bigint'
                ? value.toString()
                : value,
            ),
          }],
        });
      }
    }
    return Promise.all([
      this.admin.createTopics(addresses),
      this.producer.sendBatch({
        topicMessages: batch,
        compression: CompressionTypes.Snappy,
      }),
    ]).finally(() => {
      addresses.forEach((address) =>  {
        this.poolAddedOutbox.delete(address)
        console.info(`Added topic ${address} to kafka`);
      });
    });
  }

  async processOutbox(): Promise<void> {
    while (!this.shuttingDown) {
      await sleep(1000);
    }
    clearInterval(this.poolAddedOutboxInterval);
    clearInterval(this.messageOutboxInterval);
    await Promise.all([
      this.processPoolAdded(),
      this.processMessages(),
    ]);
  }

  async run(): Promise<[JsonRpcProvider, void]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Promise.all([
      this.provider.on(this.filter, (log) => this.processLog(log)),
      this.processOutbox(),
    ]);
  }

}
