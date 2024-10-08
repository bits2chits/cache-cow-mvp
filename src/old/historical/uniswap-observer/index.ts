import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { sleep } from '../../libs/sleep';
import fs from 'fs';
import { clearInterval } from 'timers';
import { Chain, RpcCollection } from '../../enums/rpcs';
import UniswapObserverState from '../../../uniswapFactoryObserver.state.json';
import BlockEvents from '../../events/node/block-events';
import { ethers, Filter, Log } from 'ethers';

export class UniswapFactoryObserver {
  producer: KafkaProducer;
  admin: KafkaAdmin;
  chain: Chain;
  rpcCollection: RpcCollection;
  blockEvents: BlockEvents;
  initialized: boolean;
  logInterval = 1000;
  logTimer: NodeJS.Timer;
  lastBlockChecked: number;
  existingUniswapAddresses: Set<string>;
  observedTopics: Set<string>;
  observedEventSignatures: string[];

  constructor(
    chain: Chain,
    config: string[] = UniswapObserverState.observedEventSignatures,
  ) {
    this.chain = chain;
    this.rpcCollection = new RpcCollection();
    this.blockEvents = new BlockEvents();
    this.observedEventSignatures = config.length > 0 ? config : UniswapObserverState.observedEventSignatures;
    this.initialize()
      .then(() => {
        this.initialized = true;
      })
      .catch(console.error);
    process.on('SIGINT', async () => {
      await this.shutdown();
    });
    process.on('exit', async () => {
      await this.shutdown();
    });
  }

  logState(): void {
    if (process.env.NODE_ENV !== 'test') {
      console.info({
        existingUniswapAddresses: this.existingUniswapAddresses ? Array.of(...this.existingUniswapAddresses) : [],
        observedTopics: this.observedTopics ? Array.of(...this.observedTopics) : [],
        lastBlockChecked: this.lastBlockChecked || 0,
      });
    }
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    this.producer = await ProducerFactory.getProducer();
    this.observedTopics = new Set(this.observedEventSignatures.map(ethers.id));
    const topics = (await this.admin.listTopics());
    this.existingUniswapAddresses = new Set(topics.filter((topic) => !topic.startsWith('__') && !topic.includes('.')));
    this.blockEvents.onLogData(this.addAddress.bind(this));
    if (!topics.includes(SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED)) {
      console.info(`Creating system event topic: ${SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED}`);
      await this.admin.createTopic(SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED);
    }

    console.info(`Setting log interval to ${this.logInterval}`);
    this.logTimer = setInterval(() => this.logState(), this.logInterval);

    console.info(`Initialized observer with topics: ${JSON.stringify(Array.of(...this.existingUniswapAddresses))}`);
    this.initialized = true;
  }

  async initialization(): Promise<void> {
    while (!this.initialized) {
      await sleep(100);
    }
  }

  async shutdown(): Promise<void> {
    if (this.initialized) {
      await this.producer.disconnect();
      await this.admin.disconnect();

      if (process.env.NODE_ENV !== 'test') {
        fs.writeFileSync('uniswapFactoryObserver.state.json',
          JSON.stringify({
            existingUniswapAddresses: this.existingUniswapAddresses ? Array.of(...this.existingUniswapAddresses) : [],
            observedEventSignatures: this.observedEventSignatures ? Array.of(...this.observedEventSignatures) : [],
            lastBlockChecked: this.lastBlockChecked || 0,
          }, null, 2),
        );
      }
      clearInterval(this.logInterval);
    }
  }

  async addAddress(chain: string, log: Log): Promise<void> {
    if (!this.existingUniswapAddresses.has(log.address)) {
      console.info(`Received event from ${chain} - ${log.blockNumber}-${log.index}`);
      await this.admin.createTopic(log.address);
      this.existingUniswapAddresses.add(log.address);
      await this.producer.send({
        topic: SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED,
        messages: [{
          key: log.address,
          value: JSON.stringify(log, (_, value) =>
            typeof value === 'bigint'
              ? value.toString()
              : value,
          ),
        }],
      });
      console.info(`Added topic ${log.address} to kafka. Existing topics: ${Array.of(...this.existingUniswapAddresses)}`);
    }
  }

  async logTopicIsObserved(topic: string): Promise<boolean> {
    await this.initialization();
    return this.observedTopics.has(topic);
  }

  async getPastLogs(filter: Filter): Promise<Log[]> {
    return await this.rpcCollection.getEthersProvider(this.chain).getLogs(filter);
  }

  async scanForUniswapFactories(startBlock: number, endBlock: number): Promise<void> {
    await this.initialization();

    for (let i = startBlock; i < endBlock; i += 500) {
      try {
        this.lastBlockChecked = i;
        const logs = await this.getPastLogs({
          fromBlock: i,
          toBlock: i + 500,
          topics: Array.of(...this.observedTopics),
        });

        for (const log of logs) {
          await this.addAddress(this.chain, log);
        }
      } catch (e) {
        console.error(`Failed to fetch logs for block range ${i}-${i + 500}. Retrying`, e);
        i -= 500;
      }
    }
  }
}
