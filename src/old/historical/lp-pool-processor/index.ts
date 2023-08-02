import { ethers, Interface } from 'ethers';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { PairCreated } from '../../events/blockchain/pair-created';
import { LpPoolAddedMessage } from './types';
import Erc20Abi from '../../abis/erc20.json';
import UniswapFactoryAbi from '../../abis/uniswap-factory.json';
import { RpcCollection } from '../../enums/rpcs';
import BaseProcessor from '../../processor';
import { ProcessorInterface } from '../../processor/types';

export class LpPoolProcessor extends BaseProcessor implements ProcessorInterface {
  uniswapInterface: Interface;
  erc20Interface: Interface;
  rpcCollection: RpcCollection;
  admin: KafkaAdmin;
  producer: KafkaProducer;
  consumer: KafkaConsumer;

  constructor() {
    super();
    this.uniswapInterface = new ethers.Interface(UniswapFactoryAbi);
    this.erc20Interface = new ethers.Interface(Erc20Abi);
    this.rpcCollection = new RpcCollection();
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
        topics: [SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED],
      }, {
        groupId: `${this.constructor.name}-1`,
      },
    );
    const topics = (await this.admin.listTopics());
    if (!topics.includes(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY)) {
      console.log(`Creating system event topic: ${SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY}`);
      await this.admin.createTopic(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY);
    }
    await Promise.all([
      await this.consumer.run({
        eachMessage: async ({ message }): Promise<void> => {
          await this.processLpPoolAddedMessage(JSON.parse(message.value.toString()));
        },
      }),
      super.start()
    ]);
  }

  async fetchErc20Metadata(chain: string, event: PairCreated): Promise<PairCreated> {
    const provider = this.rpcCollection.getEthersProvider(chain);
    const token0Contract = new ethers.Contract(event.get('token0'), this.erc20Interface, provider);
    const token1Contract = new ethers.Contract(event.get('token1'), this.erc20Interface, provider);
    event.set('token0Symbol', await token0Contract.symbol());
    event.set('token0Decimals', await token0Contract.decimals());
    event.set('token1Symbol', await token1Contract.symbol());
    event.set('token1Decimals', await token1Contract.decimals());
    return event;
  }

  async processLpPoolAddedMessage(message: LpPoolAddedMessage): Promise<void> {
    try {
      const { chain, ...log } = message;
      const eventFromLog = new PairCreated(this.uniswapInterface.parseLog(log));
      const event = await this.fetchErc20Metadata(chain, eventFromLog);
      await this.producer.send({
        topic: SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY,
        messages: [{
          key: event.get('key'),
          value: JSON.stringify(event, (_, value) => {
            typeof value === 'bigint'
              ? value.toString()
              : value;
          }),
        }],
      });
    } catch (e) {
      console.error(`Unable to process logs for message. Deleting pool`, e);
    }
  }

  async shutdown(): Promise<void> {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    await this.admin.disconnect();
    await super.shutdown();
    console.log('LP Pool Processor shutdown completed');
  }
}
