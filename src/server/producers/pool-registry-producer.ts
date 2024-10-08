import { ContractRunner, ethers, Interface, Log } from 'ethers';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { KafkaMessage } from 'kafkajs';
import UniswapV2Abi from '../../abis/uniswap-v2.json';
import Erc20Abi from '../../abis/erc20.json';
import { Erc20Metadata, PairMetadata } from './types';

export class PoolRegistryProducer {
  provider: ContractRunner;
  uniswapV2Interface: Interface;
  erc20Interface: Interface;
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;

  constructor(provider: ContractRunner) {
    this.provider = provider;
    this.uniswapV2Interface = new ethers.Interface(UniswapV2Abi);
    this.erc20Interface = new ethers.Interface(Erc20Abi);
  }

  async initialize(): Promise<void> {
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.LP_POOL_ADDED],
    }, {
      groupId: uuid(),
    });
    this.initialized = true;
  }

  async getTokenMetadata(address: string): Promise<Erc20Metadata> {
    const contract = new ethers.Contract(address, this.erc20Interface, this.provider);
    const results = await Promise.all([contract.symbol(), contract.decimals()]);
    return {
      address,
      symbol: results[0],
      decimals: results[1].toString(),
    };
  }

  async processPoolAddress(message: KafkaMessage): Promise<PairMetadata> {
    const log: Log = JSON.parse(message.value.toString());
    const contract = new ethers.Contract(log.address, this.uniswapV2Interface, this.provider);
    const [token0, token1] = await Promise.all([contract.token0(), contract.token1()]);
    const [token0Metadata, token1Metadata] = await Promise.all([this.getTokenMetadata(token0), this.getTokenMetadata(token1)]);
    return {
      pair: log.address,
      token0: token0Metadata,
      token1: token1Metadata,
    };
  }

  static normalizedPairString(pair: PairMetadata): string {
    return [pair.token0.symbol, pair.token1.symbol]
      .sort((a, b) => a.localeCompare(b))
      .join('')
      .replace(/\W/gi, '');
  }

  async updateLpPoolRegistry(pair: PairMetadata): Promise<void> {
    await this.producer.send({
      topic: SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY,
      messages: [{
        key: `${pair.pair}:${pair.token0.symbol}:${pair.token1.symbol}`,
        value: JSON.stringify(pair),
      }],
    });
  }

  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.consumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        const pair = await this.processPoolAddress(message);
        await this.updateLpPoolRegistry(pair);
      },
    });
  }
}
