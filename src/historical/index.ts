// import UniswapFactoryAbi from "../abis/uniswap-factory.json"
import {KafkaAdmin} from "../kafka/admin"
import {Filter, Log, Web3} from "web3"
import {sleep} from "../libs/sleep"


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
  admin: KafkaAdmin
  web3: Web3
  initialized: boolean
  existingUniswapAddresses: Set<string>
  observedTopics: Set<string>

  constructor(admin: KafkaAdmin, web3: Web3, config: string[] = eventSignaturesObserved) {
    this.admin = admin
    this.web3 = web3
    this.initialize(config)
      .then(() => {
        this.initialized = true
      })
      .catch(console.error)
  }

  async initialize(config: string[]): Promise<void> {
    this.observedTopics = new Set(config.map(this.web3.eth.abi.encodeEventSignature))
    this.existingUniswapAddresses = new Set(await this.admin.listTopics())
  }

  async addAddress(address: string): Promise<void> {
    if (!this.existingUniswapAddresses.has(address)) {
      await this.admin.createTopic(address)
      this.existingUniswapAddresses.add(address)
    }
  }

  async logTopicIsObserved(topic: string): Promise<boolean> {
    while (!this.initialized) {
      await sleep(100)
    }
    return this.observedTopics.has(topic)
  }

  async getPastLogs(filter: Filter): Promise<Log[]> {
    return await this.web3.eth.getPastLogs(filter) as Log[]
  }
  async scanForUniswapFactories(startBlock: number, endBlock: number): Promise<void> {
    while (!this.initialized) {
      await sleep(100)
    }
    for (let i = startBlock; i < endBlock; i+= 500) {
      const logs = await this.getPastLogs({
        fromBlock: i,
        toBlock: i + 500,
        topics: Array.of(...this.observedTopics)
      })

      for (const log of logs) {
        await this.addAddress(log.address)
      }
    }
  }
}
