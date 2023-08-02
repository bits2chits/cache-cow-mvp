import BlockEvents from '../../events/node/block-events';
import { UniswapFactoryObserver } from '../../historical/uniswap-observer';
import { KafkaProducer } from '../../kafka/producer';
import BaseProcessor from '../../processor';
import { ProcessorInterface } from '../../processor/types';
import { ethers, Interface, Log } from 'ethers';
import { Pair, PairPrice, Reserves } from './types';
import UniswapV2Abi from '../../abis/uniswap-v2.json';
import { RpcCollection } from '../../enums/rpcs';

export default class PriceProcessor extends BaseProcessor implements ProcessorInterface {
  blockEvents: BlockEvents;
  uniswapObserver: UniswapFactoryObserver;
  uniswapV2Interface: Interface;
  rpcCollection: RpcCollection;
  producer: KafkaProducer;
  lastProcessedBlock: number;

  constructor(blockEvents: BlockEvents, uniswapObserver: UniswapFactoryObserver, producer: KafkaProducer) {
    super();
    this.blockEvents = blockEvents;
    this.uniswapObserver = uniswapObserver;
    this.uniswapV2Interface = new ethers.Interface(UniswapV2Abi);
    this.rpcCollection = new RpcCollection();
    this.producer = producer;
  }

  async initialize(): Promise<void> {
    this.blockEvents.onNewBlock(this.onBlock.bind(this));
    this.blockEvents.onLogData(this.onLogData.bind(this));
    await super.start();
  }

  async getReserves(chain: string | symbol, address: string): Promise<Reserves> {
    const uniswapPairContract = new ethers.Contract(address, this.uniswapV2Interface, this.rpcCollection.getEthersProvider(chain));
    return await uniswapPairContract.getReserves();
  }

  async fetchPairAddresses(chain: string | symbol, address: string): Promise<Pair> {
    const uniswapPairContract = new ethers.Contract(address, this.uniswapV2Interface, this.rpcCollection.getEthersProvider(chain));
    const token0 = await uniswapPairContract.token0();
    const token1 = await uniswapPairContract.token1();
    return { token0, token1 };
  }

  calcPrice(reserves: Reserves): PairPrice {
    // The name parameter should be of type string. Any is used only to trigger the rule.
    return {
      token0Price: Number(parseInt(reserves._reserve0.toString().substring(0, 6)) / parseInt(reserves._reserve1.toString().substring(0, 6))),
      token1Price: Number(parseInt(reserves._reserve1.toString().substring(0, 6)) / parseInt(reserves._reserve0.toString().substring(0, 6))),
    };
  }

  async onLogData(chain: string, log: Log): Promise<void> {
    console.info(`Received log from ${chain} topic: ${log.topics[0]}`);
  }

  onBlock(chain: string, blockNumber: number): void {
    console.log(blockNumber)
    this.uniswapObserver.existingUniswapAddresses.forEach(async (address) => {
      const reserves = await this.getReserves(chain, address);
      const pair = await this.fetchPairAddresses(chain, address);
      await this.producer.send({
        topic: this.createPriceTopic(chain, address, pair),
        messages: [{
          key: this.createMessageKey(chain, pair, blockNumber),
          value: JSON.stringify({
            _reserve0: reserves._reserve0.toString(),
            _reserve1: reserves._reserve1.toString(),
            _blockTimestampLast: reserves._blockTimestampLast.toString(),
            price: this.calcPrice(reserves),
          }),
        }],
      });
      this.lastProcessedBlock = blockNumber;
    });
  }

  createMessageKey(chain: string, pair: Pair, block: number): string {
    return `${chain}-${pair.token0}-${pair.token1}-${block}`;
  }

  createPriceTopic(chain: string, pairAddress: string, pair: Pair): string {
    return `${chain}-${pairAddress}-${pair.token0}-${pair.token1}-price`;
  }

  async shutdown(): Promise<void> {
    await super.shutdown();
  }
}
