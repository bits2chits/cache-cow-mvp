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
import { singleton } from 'tsyringe'

export enum SYSTEM_EVENT_TOPICS {
  LP_POOL_EVENT_LOGS = "pool.events.logs",
  LP_POOL_ADDED = "pool.events.lp-pool-added",
  LP_POOL_REGISTRY = "pool.events.lp-pool-registry"
}

// https://github.com/tulios/kafkajs/tree/master#-usage
const defaultKafkaConfig = {
  clientId: 'cache-cow',
  brokers: ['localhost:9092'] // from docker-compose
}

const defaultProducerConfig: ProducerConfig = {
  createPartitioner: Partitioners.DefaultPartitioner
}

@singleton()
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
