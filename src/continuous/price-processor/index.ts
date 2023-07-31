import BlockEvents from "../../events/node/block-events"
import {Log, Web3} from 'web3'
import { UniswapFactoryObserver } from '../../historical/uniswap-observer'
import { KafkaProducer } from "../../kafka/producer"
import { Pair, calcPrice, fetchPairAddresses, getReserves } from "../../main"
import BaseProcessor from "../../processor"
import { ProcessorInterface } from "../../processor/types"

export default class PriceProcessor extends BaseProcessor implements ProcessorInterface {
  web3: Web3
  blockEvents: BlockEvents
  uniswapObserver: UniswapFactoryObserver
  producer: KafkaProducer
  lastProcessedBlock: number
  constructor(web3: Web3, blockEvents: BlockEvents, uniswapObserver: UniswapFactoryObserver, producer: KafkaProducer) {
    super()
    this.web3 = web3
    this.blockEvents = blockEvents
    this.uniswapObserver = uniswapObserver
    this.producer = producer
  }

  async initialize(): Promise<void> {
    this.blockEvents.onNewBlock(this.onBlock.bind(this))
    this.blockEvents.onLogData(this.onLogData.bind(this))
  }

  async onLogData(chain: string, log: Log): Promise<void> {
    console.info(`Received log from ${chain} topic: ${log.topics[0]}`)
  }

  onBlock(chain: string, blockNumber: number): void {
    this.uniswapObserver.existingUniswapAddresses.forEach(async (address) => {
      const reserves = await getReserves(this.web3, address)
      const pair = await fetchPairAddresses(this.web3, address)
      await this.producer.send({
        topic: this.createPriceTopic(chain, address, pair),
        messages: [{
          key: this.createMessageKey(chain, pair, blockNumber),
          value: JSON.stringify({
            _reserve0: reserves._reserve0.toString(),
            _reserve1: reserves._reserve1.toString(),
            _blockTimestampLast: reserves._blockTimestampLast.toString(),
            price: calcPrice(reserves)
          })
        }]
      })
      this.lastProcessedBlock = blockNumber
    })
  }

  createMessageKey(chain: string, pair: Pair, block: number): string {
    return `${chain}-${pair.token0}-${pair.token1}-${block}`
  }

  createPriceTopic(chain: string, pairAddress: string, pair: Pair): string {
    return `${chain}-${pairAddress}-${pair.token0}-${pair.token1}-price`
  }

  async shutdown(): Promise<void> {
    await super.shutdown()
  }
}
