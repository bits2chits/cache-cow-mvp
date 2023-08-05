import { ethers, EventFilter, Interface, JsonRpcProvider, Log, WebSocketProvider } from 'ethers';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { PoolRegistryConsumer } from '../pool-registry/pool-registry-consumer';
import { ProducerRecord } from 'kafkajs';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { sleep } from '../../libs/sleep';
import { EventFactory } from '../../events/blockchain/event-factory';
import { AbstractEvent } from '../../events/blockchain/abstract-event';

export class EventProcessor {
  provider: JsonRpcProvider | WebSocketProvider;
  registry: PoolRegistryConsumer;
  poolInterface: Interface;
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

  constructor(
    provider: JsonRpcProvider | WebSocketProvider,
    registry: PoolRegistryConsumer,
    eventSignature: string,
    poolInterface: Interface,
  ) {
    this.provider = provider;
    this.registry = registry;
    this.poolInterface = poolInterface;
    this.eventSignature = eventSignature;
    this.filter = {
      address: null,
      topics: [ethers.id(this.eventSignature)],
    };
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    this.producer = await ProducerFactory.getProducer();
    this.poolAddedOutboxInterval = setInterval(() => this.processPoolAdded(), 1000);
    this.messageOutboxInterval = setInterval(() => this.processMessages(), 100);
    this.initialized = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processLog(log: any): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    const parsedLog = this.poolInterface.parseLog(log);
    const pair = await this.registry.getPairMetadata(log.address);
    if (pair === undefined) {
      console.warn(`Pair data was not available, skipping log with address: ${log.address}`)
      return;
    }

    const event = EventFactory.getEvent<AbstractEvent>(
      this.eventSignature, {
        address: log.address,
        pair,
        log: parsedLog,
      },
    );

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
    for (let i = 0; i < this.messageOutbox.length; i++) {
      if (this.registry.has(this.messageOutbox[i].topic)) {
        console.info(`Processing message ${i + 1}`);
        const message = this.messageOutbox.shift();
        try {
          await this.producer.send(message);
        } catch (e) {
          console.error('Could not process message', e);
          this.messageOutbox.push(message);
        }
      } else {
        console.info(`Skipping message ${i + 1}. Awaiting creation of topic: ${this.messageOutbox[i].topic}`);
      }
    }
  }

  async processPoolAdded(): Promise<void> {
    for (const [address, log] of this.poolAddedOutbox) {
      if (!this.registry.has(address)) {
        await this.admin.createTopic(address);
        await this.producer.send({
          topic: SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED,
          messages: [{
            key: log.address,
            value: JSON.stringify(log, (_, value) =>
              typeof value === 'bigint'
                ? value.toString()
                : value,
            ),
          }],
        }).finally(() => {
          this.poolAddedOutbox.delete(address);
          console.info(`Added topic ${log.address} to kafka`);
        });
      }
    }
  }

  async processOutbox(): Promise<void> {
    while (!this.shuttingDown) {
      await sleep(1000);
    }
    clearInterval(this.poolAddedOutboxInterval);
    clearInterval(this.messageOutboxInterval);
    await Promise.all([
      await this.processPoolAdded(),
      await this.processMessages(),
    ]);
  }

  async run(): Promise<[JsonRpcProvider | WebSocketProvider, void]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Promise.all([
      this.provider.on(this.filter, async (log) => await this.processLog(log)),
      this.processOutbox(),
    ]);
  }

}
