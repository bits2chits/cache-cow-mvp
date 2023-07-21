import {Admin, AdminConfig, Kafka, KafkaConfig, Consumer, ConsumerConfig, Partitioners, Producer, ProducerConfig} from 'kafkajs'

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

export function createAdmin(config?: AdminConfig): Admin {
  return getKafkaInstance().admin(config)
}

export function createConsumer(config: ConsumerConfig): Consumer {
  return getKafkaInstance().consumer(config)
}

const defaultProducerConfig: ProducerConfig = {
  createPartitioner: Partitioners.DefaultPartitioner
}
export function createProducer(config: ProducerConfig = defaultProducerConfig): Producer {
  return getKafkaInstance().producer(config)
}
