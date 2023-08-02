import BlockEvents from '../../../src/events/node/block-events';
import { ProducerRecord } from 'kafkajs';
import { KafkaProducer } from '../../../src/kafka/producer';
import { sleep } from '../../../src/libs/sleep';
import { Chain } from '../../../src/enums/rpcs';
import { jest } from '@jest/globals';
import { MATIC_USDC } from '../../../src/enums/pairs';
import PriceProcessor from '../../../src/old/continuous/price-processor';
import { fetchBlockNumber, fetchPairAddress } from '../../../src/old/continuous/utils';
import { UniswapFactoryObserver } from '../../../src/old/historical/uniswap-observer';

jest.setTimeout(10000);

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
  let producer: MockProducer;
  let blockEvents: BlockEvents;
  let priceProcessor: PriceProcessor;
  let uniswapObserver: MockUniswapObserver;

  beforeAll(async (): Promise<void> => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    uniswapObserver = new MockUniswapObserver(new Set([address]));
  });
  beforeEach(async (): Promise<void> => {
    producer = new MockProducer();
    blockEvents = await new BlockEvents();
    priceProcessor = new PriceProcessor(blockEvents, uniswapObserver as UniswapFactoryObserver, producer as unknown as KafkaProducer);

  });
  afterEach(async (): Promise<void> => {
    blockEvents.cleanup();
    await priceProcessor.shutdown();
  });
  // Probably deprecate these? -->
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(chain);
    expect(typeof blockNumber).toBe('number');
  });
  it('should fetch address for a pair of tokens', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    expect(typeof address).toBe('string');
  }); // ----<
  it('Tests Price Processor', async () => {
    const currentBlock = await fetchBlockNumber(chain);
    priceProcessor.initialize()
        .catch(console.error);
    blockEvents.newBlock(chain, currentBlock);
    await sleep(2000);
    expect(producer.sends.length).toEqual(1);
  });
  it('should get reserves from address', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    priceProcessor.initialize()
      .catch(console.error);

    const reserves = await priceProcessor.getReserves(chain, address);
    expect(typeof reserves._reserve0).toBe('bigint');
    expect(typeof reserves._reserve1).toBe('bigint');
    expect(typeof reserves._blockTimestampLast).toBe('bigint');
  });
  it('should calculate price data for matic usdc', async () => {
    const address = await fetchPairAddress(chain, { token0: MATIC_USDC.WMATIC, token1: MATIC_USDC.USDC });
    priceProcessor.initialize()
      .catch(console.error);

    const reserves = await priceProcessor.getReserves(chain, address);
    const price = priceProcessor.calcPrice(reserves);
    expect(typeof price.token0Price).toEqual('number');
    expect(typeof price.token1Price).toEqual('number');
  });
});
