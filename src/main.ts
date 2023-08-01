import { Chain, RpcCollection } from './enums/rpcs';
import { ContractRunner, ethers, Log } from 'ethers';
import { Sync } from './events/blockchain/sync';
import UniswapV2Abi from './abis/uniswap-v2.json';
import Erc20Abi from './abis/erc20.json';
import { AdminFactory, KafkaAdmin } from './kafka/admin';
import { KafkaProducer, ProducerFactory } from './kafka/producer';
import { SYSTEM_EVENT_TOPICS } from './kafka';
import { ConsumerFactory, KafkaConsumer } from './kafka/consumer';
import { ProducerRecord } from 'kafkajs';
import { v4 as uuid } from 'uuid';

let admin: KafkaAdmin;
let producer: KafkaProducer;
let registryConsumer: KafkaConsumer;
let poolAddedConsumer: KafkaConsumer;
let existingUniswapAddresses: Set<string>;

const chain = Chain.Polygon;
const rpcCollection = new RpcCollection();
const uniswapV2Interface = new ethers.Interface(UniswapV2Abi);
const erc20Interface = new ethers.Interface(Erc20Abi);
const addTopicOutbox = new Map<string, Log>();
const messageOutbox: ProducerRecord[] = [];
const pairs: Map<string, PairMetadata> = new Map();

async function initializeSystemTopics(): Promise<void> {
  const topics: string[] = (await admin.listTopics());
  existingUniswapAddresses = new Set(topics.filter((topic) => !topic.startsWith('__') && !topic.includes('.')));
  if (!topics.includes(SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED)) {
    console.info(`Creating system event topic: ${SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED}`);
    await admin.createTopic(SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED);
  }
  if (!topics.includes(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY)) {
    console.log(`Creating system event topic: ${SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY}`);
    await admin.createTopic(SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY);
  }
}

export interface PairMetadata {
  pair: string;
  token0: Erc20Metadata;
  token1: Erc20Metadata;
}

export interface Erc20Metadata {
  address: string;
  symbol: string;
  decimals: number;
}

async function getTokenMetadata(provider: ContractRunner, address: string): Promise<Erc20Metadata> {
  const contract = new ethers.Contract(address, erc20Interface, provider);
  const results = await Promise.all([contract.symbol(), contract.decimals()]);
  return {
    address,
    symbol: results[0],
    decimals: results[1].toString(),
  };
}

async function processLpPoolAddedMessage(provider: ContractRunner, log: Log): Promise<void> {
  try {
    const contract = new ethers.Contract(log.address, uniswapV2Interface, provider);
    const [token0, token1] = await Promise.all([contract.token0(), contract.token1()]);
    const [token0Metadata, token1Metadata] = await Promise.all([getTokenMetadata(provider, token0), getTokenMetadata(provider, token1)]);
    const pair: PairMetadata = {
      pair: log.address,
      token0: token0Metadata,
      token1: token1Metadata,
    };
    await producer.send({
      topic: SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY,
      messages: [{
        key: `${log.address}:${token0Metadata.symbol}:${token1Metadata.symbol}`,
        value: JSON.stringify(pair),
      }],
    });
  } catch (e) {
    console.error(`Unable to process logs for message. Deleting pool`, e);
  }
}

async function processMessages(): Promise<void> {
  for (let i = 0; i < messageOutbox.length; i++) {
    if (existingUniswapAddresses.has(messageOutbox[i].topic)) {
      console.info(`Processing message ${i + 1}`);
      const message = messageOutbox.shift();
      try {
        await producer.send(message);
      } catch (e) {
        console.error('Could not process message', e);
        messageOutbox.push(message);
      }
    } else {
      console.info(`Skipping message ${i + 1}. Awaiting creation of topic: ${messageOutbox[i].topic}`);
    }
  }
}

async function processAddAddress(): Promise<void> {
  for (const [address, log] of addTopicOutbox) {
    if (!existingUniswapAddresses.has(address)) {
      existingUniswapAddresses.add(address);
      await admin.createTopic(address);
      await producer.send({
        topic: SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED,
        messages: [{
          key: log.address,
          value: JSON.stringify(log, (_, value) =>
            typeof value === 'bigint'
              ? value.toString()
              : value,
          ),
        }],
      }).finally(() => {
        addTopicOutbox.delete(address);
        console.info(`Added topic ${log.address} to kafka`);
      });
    }
  }
}

async function main(): Promise<void> {
  const provider = rpcCollection.getEthersProvider(chain);
  admin = await AdminFactory.getAdmin();
  producer = await ProducerFactory.getProducer();
  registryConsumer = await ConsumerFactory.getConsumer({
    topics: [SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY],
    fromBeginning: true
  }, {
    groupId: uuid()
  })
  poolAddedConsumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED],
    }, {
      groupId: uuid(),
    },
  );

  await initializeSystemTopics();

  setInterval(() => processAddAddress(), 1000);
  setInterval(() => processMessages(), 100);
  provider.pollingInterval = 2000;
  const iface = new ethers.Interface(UniswapV2Abi);
  const filter = {
    address: null,
    topics: [ethers.id('Sync(uint112,uint112)')],
  };
  await Promise.all([
    provider.on(filter, async (log) => {
      const res = iface.parseLog(log);
      const event = new Sync(log.address, pairs.get(log.address), res);
      console.info(`Adding log to outbox: ${log.address}`)
      addTopicOutbox.set(log.address, log);
      messageOutbox.push({
        topic: log.address,
        messages: [{
          key: event.get('key'),
          value: JSON.stringify(event),
        }],
      });
    }),
    registryConsumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        const pair: PairMetadata = JSON.parse(message.value.toString());
        pairs.set(pair.pair, pair);
      },
    }),
    poolAddedConsumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        await processLpPoolAddedMessage(provider, JSON.parse(message.value.toString()));
      },
    }),
  ]);
}

main()
  .catch(console.error)
