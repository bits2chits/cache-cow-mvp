import { MATIC_USDC } from '../../../src/enums/pairs';
import PriceProcessor from '../../../src/continuous/price-processor';
import BlockEvents from '../../../src/events/node/block-events';
import { fetchBlockNumber, fetchPairAddress } from '../../../src/main';
import { UniswapFactoryObserver } from '../../../src/historical/uniswap-observer';
import { ProducerRecord } from 'kafkajs';
import { KafkaProducer } from '../../../src/kafka/producer';
import { sleep } from '../../../src/libs/sleep';
import { Chain } from '../../../src/enums/rpcs';

class MockUniswapObserver {
  existingUniswapAddresses: Set<string>;

  constructor(addresses: Set<string>) {
    this.existingUniswapAddresses = addresses;
  }
}

class MockProducer {
  sends: ProducerRecord[] = [];

  send(record: ProducerRecord): void {
    this.sends.push(record);
  }
}

describe('Tests Price Processor', () => {
  const chain = Chain.Polygon;
  let blockEvents: BlockEvents;
  beforeEach(async (): Promise<void> => {
    blockEvents = await new BlockEvents();
  });
  afterEach((): void => {
    blockEvents.cleanup();
  });
  it('Tests Price Processor', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    const addresses = new Set([address]);
    const uniswapObserver = new MockUniswapObserver(addresses);
    const producer = new MockProducer();
    const currentBlock = await fetchBlockNumber(chain);
    const pp = new PriceProcessor(blockEvents, uniswapObserver as UniswapFactoryObserver, producer as unknown as KafkaProducer);
    await pp.initialize();
    blockEvents.newBlock('Polygon', currentBlock);
    await sleep(2000);
    console.log('producer', producer);
    expect(producer.sends.length).toEqual(1);
  });
});
