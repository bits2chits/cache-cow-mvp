import { KafkaProducer, KafkaProducerFactory } from '../../kafka/producer';
import { KafkaConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { KafkaMessage } from 'kafkajs';
import { container, singleton } from 'tsyringe';

@singleton()
export class HistoricalPricesProducer {
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;

  async initialize(): Promise<void> {
    const ProducerFactory = container.resolve<KafkaProducerFactory>(KafkaProducerFactory)
    const ConsumerFactory = container.resolve<KafkaConsumerFactory>(KafkaConsumerFactory)
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.TOKEN_PRICE_PER_MINUTE],
    }, {
      groupId: uuid(),
    });
    this.initialized = true;
  }

  static daySpecificIsoStringFromKey(key: string): string {
    return key.slice(0, key.indexOf('@'));
  }

  static hourSpecificIsoStringFromKey(key: string): string {
    return key.slice(0, key.indexOf(':'));
  }

  static minuteSpecificIsoString(isoString: string = (new Date()).toISOString()): string {
    return isoString.replace('T', '@').slice(0, 16);
  }

  async produceTokenHourPrices(messages: KafkaMessage[]): Promise<void> {
    for (const message of messages) {
      await this.producer.send({
        topic: SYSTEM_EVENT_TOPICS.TOKEN_PRICE_PER_HOUR,
        messages: [{
          key: HistoricalPricesProducer.hourSpecificIsoStringFromKey(message.key.toString()),
          value: message.value,
        }],
      });
    }
  }

  async produceTokenDayPrices(messages: KafkaMessage[]): Promise<void> {
    for (const message of messages) {
      await this.producer.send({
        topic: SYSTEM_EVENT_TOPICS.TOKEN_PRICE_PER_DAY,
        messages: [{
          key: HistoricalPricesProducer.daySpecificIsoStringFromKey(message.key.toString()),
          value: message.value,
        }],
      });
    }
  }

  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    await this.consumer.run({
      eachBatch: async ({ batch }) => {
        await this.produceTokenHourPrices(batch.messages);
        await this.produceTokenDayPrices(batch.messages);
      },
    });
  }
}
