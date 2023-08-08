import { ContractRunner, ethers, Interface, Log } from 'ethers';
import { KafkaConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { KafkaProducer, KafkaProducerFactory } from '../../kafka/producer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { KafkaMessage } from 'kafkajs';
import { Erc20Metadata, PairMetadata } from './types';
import { KafkaAdmin } from '../../kafka/admin';
import { container } from 'tsyringe';

export class PoolRegistryProducer {
  provider: ContractRunner;
  uniswapV2Interface: Interface;
  erc20Interface: Interface;
  admin: KafkaAdmin;
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;

  constructor(provider: ContractRunner, admin: KafkaAdmin, uniswapV2Interface: Interface, erc20Interface: Interface) {
    this.provider = provider;
    this.admin = admin;
    this.uniswapV2Interface = uniswapV2Interface;
    this.erc20Interface = erc20Interface;
  }

  async initialize(): Promise<void> {
    const ProducerFactory = container.resolve<KafkaProducerFactory>(KafkaProducerFactory)
    const ConsumerFactory = container.resolve<KafkaConsumerFactory>(KafkaConsumerFactory)
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

  async createTargetPriceTopic(pair: PairMetadata): Promise<void> {
    await this.admin.createTopic(`price.${PoolRegistryProducer.normalizedPairString(pair)}`);
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
        await this.createTargetPriceTopic(pair);
        await this.updateLpPoolRegistry(pair);
      },
    });
  }
}
