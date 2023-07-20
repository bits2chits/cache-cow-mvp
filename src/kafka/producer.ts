import {Producer, ProducerBatch, ProducerConfig, ProducerRecord, RecordMetadata} from "kafkajs"
import {createProducer} from "./index"

export class KafkaProducer {
  config?: ProducerConfig
  producer: Producer

  constructor(config?: ProducerConfig) {
    this.config = config
    process.on('exit', async () => {
      await this.producer?.disconnect()
    })
  }

  async getInstance(): Promise<Producer> {
    if (!this.producer) {
      this.producer = await createProducer(this.config)
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

class KafkaProducerFactory {
  async getProducer(producerConfig?: ProducerConfig): Promise<KafkaProducer> {
    const producer = new KafkaProducer(producerConfig)
    await producer.initialize()
    return producer
  }
}

export const ProducerFactory = new KafkaProducerFactory()
