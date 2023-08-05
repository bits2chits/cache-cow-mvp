import { PoolRegistryConsumer } from '../pool-registry/pool-registry-consumer';
import { AdminFactory, KafkaAdmin } from '../../kafka/admin';
import { KafkaProducer, ProducerFactory } from '../../kafka/producer';
import { ConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { v4 as uuid } from 'uuid';
import { CalculatedReserves } from '../../events/blockchain/types';
import { MultiPoolPricesMap, PricesMap } from './types';
import { Sync } from '../../events/blockchain/sync';
import { PairMetadata } from '../pool-registry/types';
import { Decimal } from 'decimal.js';
import { PoolRegistryProducer } from '../pool-registry/pool-registry-producer';
import { AbstractEvent } from '../../events/blockchain/abstract-event';


export class PriceAggregateProcessor {
  registry: PoolRegistryConsumer;
  admin: KafkaAdmin;
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;
  multiPoolPrices: MultiPoolPricesMap = {};
  listeners = new Map<string, (pairs: PricesMap) => void>();

  constructor(registry: PoolRegistryConsumer) {
    this.registry = registry;
  }

  async initialize(): Promise<void> {
    this.admin = await AdminFactory.getAdmin();
    const topics = (await this.admin.listTopics()).filter((topic) => !topic.startsWith('__') && !topic.includes('.'));
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics,
    }, {
      groupId: uuid(),
    });
    this.initialized = true;
  }

  updateMultiPoolPriceState(pairSymbol: string, reserves: CalculatedReserves, pair: PairMetadata): void {
    this.multiPoolPrices[`${pairSymbol}:${pair.pair}`] = {
      key: pairSymbol,
      token0Price: reserves.token0Price,
      token1Price: reserves.token1Price,
      reserve0: reserves.reserve0,
      reserve1: reserves.reserve1,
      sqrtPriceX96: reserves.sqrtPriceX96,
      eventSignature: reserves.eventSignature,
    };
  }

  averagePrice(prices: (string | Decimal)[]): Decimal {
    return Decimal.sum(...prices).div(prices.length);
  }

  calculateAndUpdateAveragePrice(pairSymbol: string, pair: PairMetadata): void {
    const prices: CalculatedReserves[] = Object.entries(this.multiPoolPrices).reduce((acc, [key, price]) => {
      if (key.includes(':') && key.startsWith(pairSymbol)) {
        acc.push(price);
      }
      return acc;
    }, []);


    const token0PriceAverage = this.averagePrice(prices.map((it) => it.token0Price));
    const token1PriceAverage = this.averagePrice(prices.map((it) => it.token1Price));
    const eventSignatures = Array.of(...new Set(...prices.map((it) => it.eventSignature)));

    this.multiPoolPrices[pairSymbol] = {
      key: pairSymbol,
      token0: pair.token0.symbol,
      token1: pair.token1.symbol,
      token0Price: token0PriceAverage.toString(),
      token1Price: token1PriceAverage.toString(),
      poolSize: Object.keys(prices).length,
      eventSignature: eventSignatures,
      updated: new Date(),
    };
  }

  registerListener(id: string, callback: (prices: PricesMap) => void): void {
    this.listeners.set(id, callback);
  }

  async broadcastPriceUpdates(): Promise<void> {
    if (this.listeners.size > 0) {
      const prices = Object.entries(this.multiPoolPrices)
        .reduce((acc, [key, pool]) => {
          if (!key.includes(':')) {
            acc[key] = pool;
          }
          return acc;
        }, {});
      this.listeners.forEach((callback) => callback(prices));
    }
  }

  async processPairReserves(reserves: CalculatedReserves, pair: PairMetadata): Promise<void> {
    const pairSymbol = PoolRegistryProducer.normalizedPairString(pair);
    this.updateMultiPoolPriceState(pairSymbol, reserves, pair);
    this.calculateAndUpdateAveragePrice(pairSymbol, pair);
    const updatedPrice = this.multiPoolPrices[pairSymbol];
    console.log(`Updating average price for pair ${pairSymbol}. Token0: ${updatedPrice.token0Price} - Token1: ${updatedPrice.token1Price}`);
    await Promise.all([
      this.producer.send({
        topic: `prices.${pairSymbol}`,
        messages: [{
          key: pairSymbol,
          value: JSON.stringify(updatedPrice),
        }],
      }),
      this.broadcastPriceUpdates(),
    ]);
  }


  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.consumer.run({
      eachMessage: async ({ message }) => {
        const reserves: CalculatedReserves = JSON.parse(message.value.toString());
        const address = reserves.key.split(':')[1];
        const pair = await this.registry.getPairMetadata(address);
        if (pair === undefined || reserves.token0Price === '0' || reserves.token1Price === '0') {
          return;
        }
        await this.processPairReserves(reserves, pair);
      },
    });
  }
}
