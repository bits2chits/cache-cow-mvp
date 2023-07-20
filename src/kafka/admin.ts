import {Web3} from "web3"
import {Admin} from "kafkajs"
import {KafkaService, KafkaServiceInstance} from "./index"

export class KafkaAdmin {
  kafkaService: KafkaService
  admin: Admin

  constructor(kafkaService: KafkaService) {
    this.kafkaService = kafkaService
    process.on('exit', async () => {
      await this.admin?.disconnect()
    })
  }

  async getInstance(): Promise<Admin> {
    if (!this.admin) {
      this.admin = await this.kafkaService.createAdmin()
      await this.admin.connect()
    }
    return this.admin
  }

  async createTopicFromEventSignature(eventSignature: string): Promise<void> {
    const web3 = new Web3()
    const eventHash = web3.eth.abi.encodeEventSignature(eventSignature)
    await this.createTopic(eventHash)
  }

  async createTopic(topic: string): Promise<void> {
    const admin = await this.getInstance()
    const topics = await admin.listTopics()
    if (!topics.includes(topic)) {
      await admin.createTopics({
        waitForLeaders: false,
        topics: [{
          topic,
          configEntries: [
            {
              name: "cleanup.policy",
              value: "compact"
            },
            {
              name: "retention.ms",
              value: "-1"
            }
          ]
        }]
      })
    }
  }

  async deleteTopic(topic: string): Promise<void> {
    const admin = await this.getInstance()
    await admin.deleteTopics({
      topics: [topic]
    })
  }

  async listTopics(): Promise<string[]> {
    const admin = await this.getInstance()
    return admin.listTopics()
  }

  async disconnect() : Promise<void> {
    await this.admin?.disconnect()
  }
}

export const KafkaAdminInstance: KafkaAdmin = new KafkaAdmin(KafkaServiceInstance)






