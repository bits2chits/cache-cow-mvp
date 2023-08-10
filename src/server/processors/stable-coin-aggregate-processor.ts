import { KafkaProducer, KafkaProducerFactory } from '../../kafka/producer';
import { KafkaConsumerFactory, KafkaConsumer } from '../../kafka/consumer';
import { SYSTEM_EVENT_TOPICS } from '../../kafka';
import { v4 as uuid } from 'uuid';
import { PoolRegistryConsumer } from '../consumers/pool-registry-consumer';
import { CalculatedReserves } from '../../events/blockchain/types';
import { PairMetadata } from '../producers/types';
import { PricesMap } from './types';
import { PoolRegistryProducer } from '../producers/pool-registry-producer';
import { Decimal } from 'decimal.js';
import { HistoricalPricesProducer } from '../producers/historical-prices-producer';
import { autoInjectable, container, singleton } from 'tsyringe';

@autoInjectable()
@singleton()
export class StableCoinAggregateProcessor {
  producer: KafkaProducer;
  consumer: KafkaConsumer;
  prices: PricesMap = {};
  initialized = false;

  constructor(private registry?: PoolRegistryConsumer) {}

  async initialize(): Promise<void> {
    const ProducerFactory = container.resolve<KafkaProducerFactory>(KafkaProducerFactory)
    const ConsumerFactory = container.resolve<KafkaConsumerFactory>(KafkaConsumerFactory)
    this.producer = await ProducerFactory.getProducer();
    this.consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.TOKEN_PRICE_PER_MINUTE],
      fromBeginning: true,
    }, {
      groupId: uuid(),
    });
    this.initialized = true;
  }

  getSyntheticPairSymbol(stablePairPath: PairMetadata[]): PairMetadata {
    const pathPairs = stablePairPath.slice();
    const stablePair = pathPairs.pop(); // last element is always stable [xToken...stableToken]
    const [stableToken, stableTokenConnection] = PoolRegistryConsumer.isStableToken(stablePair.token0.symbol)
      ? [stablePair.token0, stablePair.token1]
      : [stablePair.token1, stablePair.token0];

    let lastOutToken = stableTokenConnection;
    for (const pair of pathPairs.reverse()) {
      if (pathPairs.indexOf(pair) === 0) {
        lastOutToken = lastOutToken.symbol === pair.token0.symbol
          ? pair.token1
          : pair.token0;
      } else {
        lastOutToken = lastOutToken.symbol === pair.token0.symbol
          ? pair.token0
          : pair.token1;
      }
    }
    return {
      pair: `SYNTHETIC:${lastOutToken.symbol}:${stableToken.symbol}`,
      token0: lastOutToken,
      token1: stableToken,
      pathToPair: stablePairPath,
    };
  }

  async processPairAddition(stablePairPath: PairMetadata[]): Promise<PairMetadata> {
    const syntheticPair = this.getSyntheticPairSymbol(stablePairPath);
    await this.producer.send({
      topic: SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY,
      messages: [{
        key: syntheticPair.pair,
        value: JSON.stringify(syntheticPair),
      }],
    });
    return syntheticPair;
  }

  // I'll clean this crap up later.
  traversePathToPair(
    pathToPair: PairMetadata[],
  ): Decimal | null {
    let lastPair = pathToPair.shift();
    const firstPairSymbol = PoolRegistryProducer.normalizedPairString(lastPair);
    let lastPrice = this.prices[firstPairSymbol];
    if (lastPrice === undefined) {
      console.warn(`Skipping pair price for ${firstPairSymbol} is not in registry yet.`);
      return null;
    }

    let midPrice: Decimal;
    for (const pair of pathToPair) {
      const currentPairSymbol = PoolRegistryProducer.normalizedPairString(pair);
      const currentPrice = this.prices[currentPairSymbol];
      if (currentPrice === undefined) {
        console.warn(`Skipping pair price for ${currentPairSymbol} is not in registry yet.`);
        return null;
      }
      midPrice = pair.token0.symbol === lastPair.token0.symbol
        ? new Decimal(lastPrice.token0Price).div(new Decimal(currentPrice.token0Price))
        : new Decimal(lastPrice.token1Price).div(new Decimal(currentPrice.token1Price));

      lastPair = pair;
      lastPrice = currentPrice;
    }
    return midPrice.toSignificantDigits(5, Decimal.ROUND_HALF_UP);
  }

  calculateStablePrice(pair: PairMetadata): CalculatedReserves | null {
    const token0Price = this.traversePathToPair(pair.pathToPair.slice());
    const reversedPath = pair.pathToPair.slice().reverse()
    const token1Price = this.traversePathToPair(reversedPath.slice());
    if (token0Price === null || token1Price === null) {
      return null;
    }
    return {
      key: PoolRegistryProducer.normalizedPairString(pair),
      token0: pair.token0.symbol,
      token1: pair.token1.symbol,
      token0Price: token0Price.toString(),
      token1Price: token1Price.toString(),
      poolSize: 0,
      updated: new Date(),
    };
  }

  async processMessage(calculatedReserves: CalculatedReserves): Promise<void> {
    let pair = this.registry.getPairBySymbol(calculatedReserves.key);

    if (PoolRegistryConsumer.isStablePairOrNull(pair)) {
      // Skip this pair since we don't have to calculate any price on it.
      return;
    }

    if (pair !== null) {
      console.info('Found non-stable pair checking if we find a stable pair route');
      const stablePairPath = this.registry.findPathToStablePair(pair);
      if (stablePairPath?.length > 0) {
        console.info('Adding synthetic pair to registry.');
        pair = await this.processPairAddition(stablePairPath);
      }
    }

    const price = this.calculateStablePrice(pair);
    const pairSymbol = PoolRegistryProducer.normalizedPairString(pair)
    if (price !== null) {
      console.info(`Updating price for synthetic pair ${pairSymbol}. Token0: ${price.token0Price} - Token1: ${price.token1Price}`)
      await this.producer.send({
        topic: SYSTEM_EVENT_TOPICS.TOKEN_PRICE_PER_MINUTE,
        messages: [{
          key: `${pairSymbol}-${HistoricalPricesProducer.minuteSpecificIsoString()}`,
          value: JSON.stringify(price)
        }]
      })
    }
  }

  async run(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    await this.consumer.run({
      eachBatch: async ({ batch }) => {
        const messages: CalculatedReserves[] = batch.messages.map((message) => JSON.parse(message.value.toString()));
        for (const message of messages) {
          this.prices[message.key] = message;
          await this.processMessage(message);
        }
      },
    });
  }
}
