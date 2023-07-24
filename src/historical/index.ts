import fs from "fs"
import {clearInterval} from "timers"
import {Filter, Log, Web3} from "web3"
import {sleep} from "../libs/sleep"
import {KafkaAdmin} from "../kafka/admin"
import {KafkaProducer} from "../kafka/producer"
import {SYSTEM_EVENTS} from "../kafka";


// This won't exist in code for long, so no need to make any config files.
const eventSignaturesObserved = [
  'PairCreated(address,address,address,uint256)'
]

/* We'll want this data stored eventually
interface UniswapFactoryMetadata {
  address: string
  createdBlock: number
  createdTimestamp: number
  chain: string
}*/

export class UniswapFactoryObserver {
  producer: KafkaProducer
  admin: KafkaAdmin
  web3: Web3
  initialized: boolean
  logInterval: NodeJS.Timer
  lastBlockChecked: number
  existingUniswapAddresses: Set<string>
  observedTopics: Set<string>

  constructor(
    producer: KafkaProducer,
    admin: KafkaAdmin,
    web3: Web3,
    config: string[] = eventSignaturesObserved,
  ) {
    this.producer = producer
    this.admin = admin
    this.web3 = web3
    this.initialize(config)
      .then(() => {
        this.initialized = true
      })
      .catch(console.error)
    process.on('SIGINT', () => {
      this.shutdown()
    })
  }

  logState(): void {
    console.info({
      existingUniswapAddresses: this.existingUniswapAddresses ? Array.of(...this.existingUniswapAddresses) : [],
      observedTopics: this.observedTopics ? Array.of(...this.observedTopics) : [],
      lastBlockChecked: this.lastBlockChecked || 0
    })
  }

  async initialize(config: string[]): Promise<void> {
    this.observedTopics = new Set(config.map(this.web3.eth.abi.encodeEventSignature))
    const topics = (await this.admin.listTopics())
    console.info(`Initialized observer with topics: ${topics}`)
    this.existingUniswapAddresses = new Set(topics.filter((topic) => !topic.startsWith("__") && !topic.includes(".")))
    if (!topics.includes(SYSTEM_EVENTS.UNISWAP_LP_POOL_ADDED)) {
      await this.admin.createTopic(SYSTEM_EVENTS.UNISWAP_LP_POOL_ADDED)
    }
    this.logInterval = setInterval(() => this.logState(), 1000)
    this.initialized = true
  }

  async initialization(): Promise<void> {
    while (!this.initialized) {
      await sleep(100)
    }
  }

  shutdown(): void {
    if (this.initialized) {
      fs.writeFileSync("uniswapFactoryObserver.state.json",
        JSON.stringify({
          existingUniswapAddresses: this.existingUniswapAddresses ? Array.of(...this.existingUniswapAddresses) : [],
          observedTopics: this.observedTopics ? Array.of(...this.observedTopics) : [],
          lastBlockChecked: this.lastBlockChecked || 0
        }, null, 2)
      )
      clearInterval(this.logInterval)
    }
  }

  async addAddress(log: Log): Promise<void> {
    if (!this.existingUniswapAddresses.has(log.address)) {
      await this.admin.createTopic(log.address)
      this.existingUniswapAddresses.add(log.address)
      await this.producer.send({
        topic: SYSTEM_EVENTS.UNISWAP_LP_POOL_ADDED,
        messages: [{
          key: log.address,
          value: JSON.stringify(log,  (_, value) =>
            typeof value === 'bigint'
              ? value.toString()
              : value
          )
        }]
      })
      console.info(`Added topic ${log.address} to kafka. Existing topics: ${Array.of(...this.existingUniswapAddresses)}`)
    }
  }

  async logTopicIsObserved(topic: string): Promise<boolean> {
    await this.initialization()
    return this.observedTopics.has(topic)
  }

  async getPastLogs(filter: Filter): Promise<Log[]> {
    return await this.web3.eth.getPastLogs(filter) as Log[]
  }

  async scanForUniswapFactories(startBlock: number, endBlock: number): Promise<void> {
    await this.initialization()

    for (let i = startBlock; i < endBlock; i += 500) {
      this.lastBlockChecked = i
      const logs = await this.getPastLogs({
        fromBlock: i,
        toBlock: i + 500,
        topics: Array.of(...this.observedTopics)
      })

      for (const log of logs) {
        await this.addAddress(log)
      }
    }
  }
}
