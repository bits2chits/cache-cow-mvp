import {Producer, ProducerBatch, ProducerConfig, ProducerRecord, RecordMetadata} from "kafkajs"
import {KafkaService, KafkaServiceInstance} from "./index"
import { singleton } from "tsyringe"

export class KafkaProducer {
  kafkaService: KafkaService
  config?: ProducerConfig
  producer: Producer

  constructor(kafkaService: KafkaService, config?: ProducerConfig) {
    this.kafkaService = kafkaService
    this.config = config
    process.on('exit', async () => {
      await this.producer?.disconnect()
    })
  }

  async getInstance(): Promise<Producer> {
    if (!this.producer) {
      this.producer = await this.kafkaService.createProducer(this.config)
      await this.producer.connect()
    }
    return this.producer
  }

  async initialize(): Promise<Producer> {
    return this.getInstance()
  }

  async send(record: ProducerRecord): Promise<RecordMetadata[]> {
    const producer = await this.getInstance()
    return producer.send(record)
  }
  async sendBatch(batch: ProducerBatch): Promise<RecordMetadata[]> {
    const producer = await this.getInstance()
    return producer.sendBatch(batch)
  }

  async disconnect(): Promise<void> {
    await this.producer?.disconnect()
  }
}

@singleton()
export class KafkaProducerFactory {
  async getProducer(producerConfig?: ProducerConfig): Promise<KafkaProducer> {
    const producer = new KafkaProducer(KafkaServiceInstance, producerConfig)
    await producer.initialize()
    return producer
  }
}
