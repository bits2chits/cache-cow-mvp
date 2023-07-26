import {ethers, Interface, JsonRpcProvider} from "ethers"
import {RPCS} from "../../enums/rpcs"
import {SYSTEM_EVENT_TOPICS} from "../../kafka"
import {AdminFactory, KafkaAdmin} from "../../kafka/admin"
import {ConsumerFactory, KafkaConsumer} from "../../kafka/consumer"
import {KafkaProducer, ProducerFactory} from "../../kafka/producer"
import {PairCreated} from "./events/PairCreated"
import {LpPoolAddedMessage} from "./Types"
import Erc20Abi from "../../abis/erc20.json"
import UniswapFactoryAbi from "../../abis/uniswap-factory.json"
import {sleep} from "../../libs/sleep"

export class LpPoolProcessor {
  running: boolean
  uniswapInterface: Interface
  erc20Interface: Interface
  admin: KafkaAdmin
  producer: KafkaProducer
  consumer: KafkaConsumer

  constructor() {
    this.uniswapInterface = new ethers.Interface(UniswapFactoryAbi)
    this.erc20Interface = new ethers.Interface(Erc20Abi)
    this.initialize()
      .catch(console.error)
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin()
    this.producer = await ProducerFactory.getProducer()
    this.consumer = await ConsumerFactory.getConsumer({
        topics: [SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED]
      }, {
        groupId: `${this.constructor.name}-1`
      }
    )
    const topics = (await this.admin.listTopics())
    if (!topics.includes(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY)) {
      console.log(`Creating system event topic: ${SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY}`)
      await this.admin.createTopic(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY)
    }
    await this.consumer.run({
      eachMessage: async ({message}): Promise<void> => {
        await this.processLpPoolAddedMessage(JSON.parse(message.value.toString()))
      }
    })
    this.running = true
    while (this.running) {
      await sleep(1000)
    }
  }

  async fetchErc20Metadata(event: PairCreated): Promise<PairCreated> {
    const provider = new JsonRpcProvider(RPCS.POLYGON)
    const token0Contract = new ethers.Contract(event.get("token0"), this.erc20Interface, provider)
    const token1Contract = new ethers.Contract(event.get("token1"), this.erc20Interface, provider)
    event.set("token0Symbol", await token0Contract.symbol())
    event.set("token0Decimals", await token0Contract.decimals())
    event.set("token1Symbol", await token1Contract.symbol())
    event.set("token1Decimals", await token1Contract.decimals())
    return event
  }

  async processLpPoolAddedMessage(message: LpPoolAddedMessage): Promise<void> {
    try {
      const eventFromLog = new PairCreated(this.uniswapInterface.parseLog(message))
      const event = await this.fetchErc20Metadata(eventFromLog)
      await this.producer.send({
        topic: SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY,
        messages: [{
          key: event.get("key"),
          value: JSON.stringify(event, (_, value) => {
            typeof value === 'bigint'
              ? value.toString()
              : value
          })
        }]
      })
    } catch (e) {
      console.error(`Unable to process logs for message. Deleting pool`, e)
    }
  }

  async shutdown(): Promise<void> {
    await this.consumer.disconnect()
    await this.producer.disconnect()
    await this.admin.disconnect()
    this.running = false
    console.log("LP Pool Processor shutdown completed")
  }
}
