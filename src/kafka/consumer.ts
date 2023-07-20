import {Consumer, ConsumerConfig, ConsumerSubscribeTopics, ConsumerRunConfig} from "kafkajs"
import {KafkaService, KafkaServiceInstance} from "./index"

export class KafkaConsumer {
  kafkaService: KafkaService
  subscriptionConfig: ConsumerSubscribeTopics
  config?: ConsumerConfig
  consumer: Consumer

  constructor(kafkaService: KafkaService) {
    this.kafkaService = kafkaService
    process.on('exit', async () => {
      await this.consumer?.disconnect()
    })
  }

  async getInstance(): Promise<Consumer> {
    if (!this.subscriptionConfig) {
      throw new Error("Invalid state: 'subscriptionConfig' has not been assigned. Did you initialize the consumer first?")
    }
    if (!this.consumer) {
      this.consumer = await this.kafkaService.createConsumer(this.config)
      await this.consumer.connect()
      await this.consumer.subscribe(this.subscriptionConfig)
    }
    return this.consumer
  }

  async initialize(subscriptionConfig: ConsumerSubscribeTopics, consumerConfig?: ConsumerConfig): Promise<Consumer> {
    this.subscriptionConfig = subscriptionConfig
    this.config = consumerConfig
    return await this.getInstance()
  }

  async run(runConfig: ConsumerRunConfig): Promise<void> {
    await (await this.getInstance())
      .run(runConfig)
  }

  async disconnect(): Promise<void> {
    await this.consumer?.disconnect()
  }
}

class KafkaConsumerFactory {
  async getConsumer(subscriptionConfig: ConsumerSubscribeTopics, consumerConfig?: ConsumerConfig): Promise<KafkaConsumer> {
    const consumer = new KafkaConsumer(KafkaServiceInstance)
    await consumer.initialize(subscriptionConfig, consumerConfig)
    return consumer
  }
}

export const ConsumerFactory = new KafkaConsumerFactory()
