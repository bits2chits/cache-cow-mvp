import Web3 from "web3"
import { MATIC_USDC } from "../../../src/enums/pairs"
import PriceProcessor from '../../../src/continuous/price-processor/index';
import BlockEvents from "../../../src/events/block-events";
import { fetchBlockNumber, fetchPairAddress } from "../../../src/main";
import { UniswapFactoryObserver } from "../../../src/historical/uniswap-observer";
import { ProducerRecord } from "kafkajs";
import { KafkaProducer } from "../../../src/kafka/producer";
import { sleep } from "../../../src/libs/sleep";

class MockUniswapObserver {
  existingUniswapAddresses: Set<string>
  constructor(addresses: Set<string>) {
    this.existingUniswapAddresses = addresses
  }
}

class MockProducer {
  sends: ProducerRecord[] = []
  send(record: ProducerRecord): void {
    this.sends.push(record)
  }
}

describe('Tests Price Processor', () => {
  const web3 = new Web3(MATIC_USDC.RPC)
  const blockEvents = new BlockEvents()
  afterEach((): void => {
    blockEvents.cleanup()
  });
  it('Tests Price Processor', async () => {
    const address = await fetchPairAddress(web3, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC })
    const addresses = new Set([address])
    const uniswapObserver = new MockUniswapObserver(addresses)
    const producer = new MockProducer()
    const currentBlock = await fetchBlockNumber(web3)
    const pp = new PriceProcessor(web3, blockEvents, uniswapObserver as UniswapFactoryObserver, producer as unknown as KafkaProducer)
    pp.initialize()
    blockEvents.newBlock('Polygon', currentBlock)
    await sleep(2000)
    console.log('producer', producer)
    expect(producer.sends.length).toEqual(1)
  })
})