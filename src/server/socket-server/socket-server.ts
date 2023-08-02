import { v4 as uuid } from 'uuid';
import { Server, Socket } from 'socket.io';
import { PairMetadata } from '../pool-registry/types';
import { FrontendPriceEntries, PricesMap, SocketEvents } from './types';
import { AdminFactory } from '../../kafka/admin';
import { ConsumerFactory } from '../../kafka/consumer';
import { PoolRegistryConsumer } from '../pool-registry/pool-registry-consumer';

const prices: PricesMap = {};
const sockets = new Map<string, Socket<SocketEvents>>();

function filterPrices(filters: string[]): FrontendPriceEntries {
  return Object.entries(prices).filter(([pair]) => {
    for (const filter of filters) {
      if (!pair.includes(filter)) {
        return false;
      }
    }
    return true;
  });
}

export async function socketServer(registry: PoolRegistryConsumer): Promise<[void, Server]> {
  const admin = await AdminFactory.getAdmin();
  const topics = await admin.listTopics();
  const consumer = await ConsumerFactory.getConsumer({
      topics: topics.filter((topic) => !topic.startsWith('__') && !topic.includes('.')),
      fromBeginning: true,
    }, {
      groupId: uuid(),
    },
  );
  const io = new Server<SocketEvents>({
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  registry.registerListener(uuid(), (pairs: PairMetadata[]) => {
    sockets.forEach((socket: Socket<SocketEvents>) => {
      socket.emit('pairs', pairs);
    });
  });

  io.on('connection', (socket) => {
    socket.data.filters = [];
    socket.on('filter', (filters: string[]) => {
      socket.data.filters = filters;
      socket.emit('prices', filterPrices(filters));
    });
    socket.emit('pairs', registry.sortedPairs);
    socket.emit('prices', filterPrices(socket.data.filters));
    sockets.set(socket.id, socket);
  });

  io.on('disconnecting', (socket) => {
    sockets.delete(socket.id);
  });

  return Promise.all([
    consumer.run({
      eachMessage: async ({ message }): Promise<void> => {
        const reserve = JSON.parse(message.value.toString());
        const address = reserve.key.split(':')[1];
        const pair = registry.getPairMetadata(address);
        if (pair) {
          const pairSymbol = `${pair.token0.symbol} → ${pair.token1.symbol}`;
          if (reserve.token0Price === '0' || reserve.token1Price === '0') {
            return;
          }
          if (prices[pairSymbol]) {
            prices[pairSymbol][address] = {
              pair: pairSymbol,
              token0Price: reserve.token0Price,
              token1Price: reserve.token1Price,
            };
          } else {
            prices[pairSymbol] = {};
            prices[pairSymbol][address] = {
              pair: pairSymbol,
              token0Price: reserve.token0Price,
              token1Price: reserve.token1Price,
            };
          }
          sockets.forEach((socket): void => {
            socket.emit('prices', filterPrices(socket.data.filters));
          });
        }
      },
    }),
    io.listen(3000),
  ]);
}
