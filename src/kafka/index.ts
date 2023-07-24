import {
  Admin,
  AdminConfig,
  Kafka,
  KafkaConfig,
  Consumer,
  ConsumerConfig,
  Partitioners,
  Producer,
  ProducerConfig
} from 'kafkajs'

// https://github.com/tulios/kafkajs/tree/master#-usage
const defaultKafkaConfig = {
  clientId: 'my-app',
  brokers: ['192.168.50.61:9092', 'localhost:9092'] // from docker-compose
}

const defaultProducerConfig: ProducerConfig = {
  createPartitioner: Partitioners.DefaultPartitioner
}


export class KafkaService {
  config: KafkaConfig
  producerConfig: ProducerConfig
  adminConfig?: AdminConfig
  kafka: Kafka

  constructor(
    config: KafkaConfig = defaultKafkaConfig,
    producerConfig: ProducerConfig = defaultProducerConfig,
    adminConfig?: AdminConfig
  ) {
    this.config = config
    this.adminConfig = adminConfig
    this.producerConfig = producerConfig
    this.kafka = new Kafka(this.config)
  }

  createAdmin(config?: AdminConfig): Admin {
    return this.kafka.admin(config)
  }

  createConsumer(config: ConsumerConfig): Consumer {
    return this.kafka.consumer(config)
  }

  createProducer(config: ProducerConfig = defaultProducerConfig): Producer {
    return this.kafka.producer(config)
  }
}

const kafkaServiceInstance = new KafkaService()
export const KafkaServiceInstance = kafkaServiceInstance
