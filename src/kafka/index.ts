import {Kafka, KafkaConfig, Consumer, ConsumerConfig, Producer, ProducerConfig} from 'kafkajs'

// https://github.com/tulios/kafkajs/tree/master#-usage
const defaultKafkaConfig = {
  clientId: 'my-app',
  brokers: ['localhost:9092'] // from docker-compose
}

// Acts as a singleton
let kafka
function getKafkaInstance(config: KafkaConfig = defaultKafkaConfig): Kafka {
  if (!kafka) {
    kafka = new Kafka(config)
  }
  return kafka
}

export function createConsumer(config: ConsumerConfig): Consumer {
  return getKafkaInstance().consumer(config)
}

export function createProducer(config?: ProducerConfig): Producer {
  return getKafkaInstance().producer(config)
}
