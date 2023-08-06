import { ethers, EventFilter, Interface, JsonRpcProvider, Log, WebSocketProvider } from 'ethers';
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
    this.producer = await ProducerFactory.getProducer();
    this.poolAddedOutboxInterval = setInterval(() => this.processPoolAdded(), 1000);
    this.messageOutboxInterval = setInterval(() => this.processMessages(), 100);
    this.initialized = true;
  }

  async processLog(log: Log): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    const pair = await this.registry.getPairMetadata(log.address);
    if (pair === undefined) {
      console.info(`Pair data was not available. Registering new pair on address: ${log.address}`)
      this.poolAddedOutbox.set(log.address, log);
      return;
    }

    const parsedLog = this.poolInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
    const event = EventFactory.getEvent<AbstractEvent>(
      this.eventSignature, {
        address: log.address,
        pair,
        log,
        parsedLog: parsedLog,
      },
    );

    this.messageOutbox.push({
      topic: SYSTEM_EVENT_TOPICS.LP_POOL_EVENT_LOGS,
      messages: [{
        key: event.get('key'),
        value: JSON.stringify(event),
      }],
    });
  }

  async processMessages(): Promise<void> {
    for (let i = 0; i < this.messageOutbox.length; i++) {
      console.info(`Processing message ${i + 1}`);
      const message = this.messageOutbox.shift();
      try {
        await this.producer.send(message);
      } catch (e) {
        console.error('Could not process message', e);
        this.messageOutbox.push(message);
      }
    }
  }

  async processPoolAdded(): Promise<void> {
    for (const [address, log] of this.poolAddedOutbox) {
      if (!this.registry.has(address)) {
        await this.producer.send({
          topic: SYSTEM_EVENT_TOPICS.LP_POOL_ADDED,
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
          console.info(`Added pool ${log.address} to registry.`);
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
      this.provider.on(this.filter, async (log: Log) => await this.processLog(log)),
      this.processOutbox(),
    ]);
  }

}
