import { PoolRegistryConsumer } from '../consumers/pool-registry-consumer';
import { KafkaProducer, KafkaProducerFactory } from '../../kafka/producer';
import { KafkaConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { v4 as uuid } from 'uuid';
import { CalculatedReserves } from '../../events/blockchain/types';
import { MultiPoolPricesMap, PricesMap } from './types';
import { Decimal } from 'decimal.js';
import { PoolRegistryProducer } from '../producers/pool-registry-producer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { autoInjectable, container, singleton } from 'tsyringe';
import { PairMetadata } from '../producers/types';
import { HistoricalPricesProducer } from '../producers/historical-prices-producer';

@autoInjectable()
@singleton()
export class PriceAggregateProcessor {
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  initialized = false;
  multiPoolPrices: MultiPoolPricesMap = {};
  listeners = new Map<string, (pairs: PricesMap) => void>();

  constructor(private registry?: PoolRegistryConsumer) {}

  async initialize(): Promise<void> {
    const ProducerFactory = container.resolve<KafkaProducerFactory>(KafkaProducerFactory)
    const ConsumerFactory = container.resolve<KafkaConsumerFactory>(KafkaConsumerFactory)
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.LP_POOL_EVENT_LOGS],
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
      eventSignatures: reserves.eventSignatures,
    };
  }

  averagePrice(prices: (string | Decimal)[]): Decimal {
    return Decimal.sum(...prices).div(prices.length).toSignificantDigits(5, Decimal.ROUND_HALF_UP);
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
    const eventSignatures = Array.of(...new Set(...prices.map((it) => it.eventSignatures)));

    this.multiPoolPrices[pairSymbol] = {
      key: pairSymbol,
      token0: pair.token0.symbol,
      token1: pair.token1.symbol,
      token0Price: token0PriceAverage.toString(),
      token1Price: token1PriceAverage.toString(),
      poolSize: Object.keys(prices).length,
      eventSignatures: eventSignatures,
      updated: new Date(),
    };
  }

  registerListener(id: string, callback: (prices: PricesMap) => void): void {
    this.listeners.set(id, callback);
  }

  async broadcastPriceUpdates(): Promise<void> {
    if (this.listeners.size > 0) {
      const prices = Object.entries(this.multiPoolPrices).reduce((acc, [key, price]) => {
          if (!key.includes(':')) {
            acc[key] = price;
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
        topic: SYSTEM_EVENT_TOPICS.TOKEN_PRICE_PER_MINUTE,
        messages: [{
          key: `${pairSymbol}-${HistoricalPricesProducer.minuteSpecificIsoString()}`,
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
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const reserves: CalculatedReserves = JSON.parse(message.value.toString());
        const address = reserves.key.split(':')[0];
        const pair = await this.registry.getPairMetadata(address);
        if (pair === undefined || reserves.token0Price === '0' || reserves.token1Price === '0') {
          return;
        }
        await this.processPairReserves(reserves, pair);
      },
    });
  }
}
