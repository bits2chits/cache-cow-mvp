import {Web3} from "web3"
import {Admin} from "kafkajs"
import {KafkaService, KafkaServiceInstance} from "./index"
import {Chain, RpcCollection} from "../enums/rpcs";

export class KafkaAdmin {
  kafkaService: KafkaService
  rpcCollection: RpcCollection
  admin: Admin

  constructor(kafkaService: KafkaService) {
    this.kafkaService = kafkaService
    this.rpcCollection = new RpcCollection()
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
    const web3 = new Web3(this.rpcCollection.getWeb3Provider(Chain.Polygon))
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

class KafkaAdminFactory {
  async getAdmin(): Promise<KafkaAdmin> {
    const admin = new KafkaAdmin(KafkaServiceInstance)
    await admin.getInstance()
    return admin
  }
}

export const AdminFactory = new KafkaAdminFactory()
