import { Kafka, KafkaConfig, Producer, Consumer, EachMessagePayload } from 'kafkajs';

const kafkaConfig: KafkaConfig = { brokers: ['localhost:9092'] }
const kafka = new Kafka(kafkaConfig)

const producer = kafka.producer()
await producer.connect()
await producer.send({
  topic: 'test-topic',
  messages: [
    { headers: { source: 'test-app' } },
    { value: 'Hello KafkaJS user!' },
  ],
})


const consumer = kafka.consumer({ groupId: 'test-group' })

await consumer.connect()
await consumer.subscribe({ topic: 'test-topic', fromBeginning: true })
await consumer.run({
  eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
    console.log({
      value: message.value?.toString(),
    })
  },
})

export interface SimpleConsumer {
  connect(): Promise<void>;
  handle(message: any): Promise<void>
  disconnect(): Promise<void>;
}

export class MyConsumer implements SimpleConsumer {
  private readonly consumer: Consumer;

  connect(): Promise<void> {
    return this.consumer.connect()
      .then(() => this.consumer.subscribe({ topic: this.config.topic }))
      .then(() => this.consumer.run({ eachMessage: payload => this.handle(payload) }))
      .catch(e => console.log(`Can't connect ${e}`));
  }
  
  handle({ topic, partition, message }: EachMessagePayload): Promise<void> {
    // handling of received message
  }

  disconnect(): Promise<void> {
    return this.consumer.disconnect()
      .catch(e => console.log(`Error on disconnect ${e}`));
  }
}

export interface MessagingFactory {
  producer(configuration: ProducerConfiguration): SimpleProducer;
  consumer(configuration: ConsumerConfiguration): SimpleConsumer;
}

export function logMessageHandler(message: KafkaMessage) {
  return console.log({
    value: message.value?.toString(),
  })
}