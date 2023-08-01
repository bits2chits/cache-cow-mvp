import { ConsumerFactory } from '../kafka/consumer';
import { SYSTEM_EVENT_TOPICS } from '../kafka';
import { PairMetadata } from '../main';
import { AdminFactory } from '../kafka/admin';
import { v4 as uuid } from 'uuid';
import { Server, Socket } from 'socket.io';

interface ServerToClientEvents {
  prices: (priceUpdates: PricesMap) => void;
  pairs: (pairs: PairMetadata[]) => void;
  filter: (filters: string[]) => void;
  hello: () => void;
}

interface TokenPrices {
  pair: string;
  token0Price: number;
  token1Price: number;
}

const pairs: Map<string, PairMetadata> = new Map();

interface PricesMap {
  [key: string]: {
    [key: string]: TokenPrices
  }
}

const prices: PricesMap = {}

async function main(): Promise<void> {
  const admin = await AdminFactory.getAdmin();
  const topics = await admin.listTopics();
  const registry = await ConsumerFactory.getConsumer({
    topics: [SYSTEM_EVENT_TOPICS.LP_POOL_REGISTRY],
    fromBeginning: true,
  }, {
    groupId: uuid(),
  });
  const consumer = await ConsumerFactory.getConsumer({
      topics: topics.filter((topic) => !topic.startsWith('__') && !topic.includes('.')),
      fromBeginning: true,
    }, {
      groupId: uuid(),
    },
  );

  const io = new Server<ServerToClientEvents>({
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  const sockets: Map<string, Socket<ServerToClientEvents>> = new Map();

  io.on('connection', (socket) => {
    sockets.set(socket.id, socket);
    socket.emit('pairs', Array.of(...pairs.values())
      .sort((a, b) => a.token0.symbol.localeCompare(b.token0.symbol)));
    socket.emit('prices', prices);
  });

  io.on('disconnecting', (socket) => {
    sockets.delete(socket.id);
  });

  await Promise.all([
    registry.run({
      eachMessage: async ({ message }): Promise<void> => {
        const pair: PairMetadata = JSON.parse(message.value.toString());
        pairs.set(pair.pair, pair);
        sockets.forEach((socket): void => {
          socket.emit('pairs', Array.of(...pairs.values())
            .sort((a, b) => a.token0.symbol.localeCompare(b.token0.symbol)));
        });
      },
    }),
    consumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        const reserve = JSON.parse(message.value.toString());
        const address = reserve.key.split(':')[1];
        const pair = pairs.get(address);
        if (pair) {
          const pairSymbol = `${pair.token0.symbol} → ${pair.token1.symbol}`;
          if (reserve.token0Price === "0" || reserve.token1Price === "0") {
            return
          }
          if (prices[pairSymbol]) {
            prices[pairSymbol][address] = {
              pair: pairSymbol,
              token0Price: reserve.token0Price,
              token1Price: reserve.token1Price,
            }
          } else {
            prices[pairSymbol] = {}
            prices[pairSymbol][address] = {
              pair: pairSymbol,
              token0Price: reserve.token0Price,
              token1Price: reserve.token1Price,
            }
          }
          sockets.forEach((socket): void => {
            socket.emit('prices', prices);
          });
          // console.table(Array.of(...prices.values()));
         //  console.info(`Update: ${new Date()}`);
        }
      },
    }),
    io.listen(3000),
  ]);
}

main()
  .catch(console.error);
