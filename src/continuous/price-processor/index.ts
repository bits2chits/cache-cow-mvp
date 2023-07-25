import BlockEvents from "../../events/block-events";
import { Web3 } from 'web3';
import { UniswapFactoryObserver } from '../../historical/uniswap-observer/index';
import { KafkaProducer } from "../../kafka/producer";
import { Pair, calcPrice, fetchPairAddresses, getReserves } from "../../main";
import { uuidV4 } from "web3-utils";

export default class PriceProcessor {
  web3: Web3
  blockEvents: BlockEvents
  uniswapObserver: UniswapFactoryObserver
  producer: KafkaProducer
  constructor(web3: Web3, blockEvents: BlockEvents, uniswapObserver: UniswapFactoryObserver, producer: KafkaProducer) {
    this.web3 = web3
    this.blockEvents = blockEvents
    this.uniswapObserver = uniswapObserver
    this.producer = producer
  }

  initialize(): void {
    this.blockEvents.onNewBlock(this.onBlock.bind(this))
  }

  onBlock(chain: string): void { // block should always be new, but can have a class property that double checks
    this.uniswapObserver.existingUniswapAddresses.forEach(async (address) => {
      const reserves = await getReserves(this.web3, address)
      const pair = await fetchPairAddresses(this.web3, address)
      // @TODO should we send updates for prices that haven't changed, or should we skip if the same?
      this.producer.send({
        topic: await this.createPriceTopic(chain, pair),
        messages: [{
          key: uuidV4(),
          value: JSON.stringify({
            _reserve0: reserves._reserve0.toString(),
            _reserve1: reserves._reserve1.toString(),
            _blockTimestampLast: reserves._blockTimestampLast.toString(),
            price: calcPrice(reserves)
          })
        }]
      })
    })
  }

  createPriceTopic(chain: string, pair: Pair): string {
    return `${chain}-${pair.token0}-${pair.token1}-price`
  }
}