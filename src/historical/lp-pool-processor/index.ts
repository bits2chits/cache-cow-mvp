// import {KafkaMessage} from "kafkajs"
import {ConsumerFactory, KafkaConsumer} from "../../kafka/consumer"
import {SYSTEM_EVENT_TOPICS} from "../../kafka"
import {ethers, Interface, JsonRpcProvider} from "ethers";
import * as Erc20Abi from "../../abis/erc20.json"
import * as UniswapFactoryAbi from "../../abis/uniswap-factory.json"
import {RPCS} from "../../enums/rpcs";

type PairCreatedEventWithMetadata = PairCreatedEvent & PairCreatedEventMetadata

interface PairCreatedEventMetadata {
  token0Symbol: string
  token0Decimals: string
  token1Symbol: string
  token1Decimals: string
}

interface PairCreatedEvent {
  token0: string
  token1: string
  pair: string
  pairIndex: number
}

interface LpPoolAddedMessage {
  id?: string;
  removed?: boolean;
  logIndex?: number;
  transactionIndex?: number;
  transactionHash?: string;
  blockHash?: string;
  blockNumber?: number;
  address?: string;
  data: string;
  topics: string[];
}

export class LpPoolProcessor {
  uniswapInterface: Interface
  erc20Interface: Interface
  consumer: KafkaConsumer

  messages: LpPoolAddedMessage[] = []

  constructor() {
    this.uniswapInterface = new ethers.Interface(UniswapFactoryAbi)
    this.erc20Interface = new ethers.Interface(Erc20Abi)
    this.initialize()
      .catch(console.error)
  }

  async initialize(): Promise<void> {
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED]
    }, {
      groupId: `${this.constructor.name}-1` }
    )
    await this.consumer.run({
      eachMessage: async ({message}): Promise<void> => {
        await this.processLpPoolAddedMessage(JSON.parse(message.value.toString()))
      }
    })
  }

  async fetchErc20Metadata(event: PairCreatedEvent): Promise<PairCreatedEventWithMetadata> {
    const provider = new JsonRpcProvider(RPCS.POLYGON)
    const token0Contract = new ethers.Contract(event.token0, this.erc20Interface, provider)
    const token1Contract = new ethers.Contract(event.token1, this.erc20Interface, provider)
    const token0Symbol = await token0Contract.symbol()
    const token0Decimals = await token0Contract.decimals()
    const token1Symbol = await token1Contract.symbol()
    const token1Decimals = await token1Contract.decimals()
    return {
      ...event,
      token0Symbol,
      token0Decimals,
      token1Symbol,
      token1Decimals
    }
  }

  async processLpPoolAddedMessage(message: LpPoolAddedMessage): Promise<void> {
    try {
      const log = this.uniswapInterface.parseLog(message)
      const event: PairCreatedEvent = {
        token0: log.args[0],
        token1: log.args[1],
        pair: log.args[2],
        pairIndex: log.args[3]
      }
      const eventWithMetadata = await this.fetchErc20Metadata(event)
      console.log(eventWithMetadata)
    } catch (e) {
      console.error(`Unable to process logs for message. Deleting pool`, e)
    }

    console.log(message)
    this.messages.push(message)
   /* const contract = new this.web3.eth.Contract(erc20Abi, message.address)
    const decodeLogs = this.web3.eth.abi.decodeLog()
    const symbol = await contract.methods.symbol().call()*/

  }
}
