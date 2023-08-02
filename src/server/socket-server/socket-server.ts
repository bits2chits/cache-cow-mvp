import { v4 as uuid } from 'uuid';
import { Server, Socket } from 'socket.io';
import { FrontendPriceEntries, SocketEvents } from './types';
import { PricesMap } from '../block-processor/types';
import { PriceAggregateProcessor } from '../block-processor/price-aggregate-processor';

let priceState: PricesMap = {};
let sortedPairs: string[] = [];

const sockets = new Map<string, Socket<SocketEvents>>();

function filterPrices(filters: string[]): FrontendPriceEntries {
  return Object.entries(priceState).filter(([pair]) => {
    for (const filter of filters) {
      if (!pair.includes(filter)) {
        return false;
      }
    }
    return true;
  });
}

export async function socketServer(
  priceAggregateProcessor: PriceAggregateProcessor,
): Promise<Server> {
  const io = new Server<SocketEvents>({
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  priceAggregateProcessor.registerListener(uuid(), (prices: PricesMap) => {
    priceState = prices;
    sortedPairs = Object.keys(prices).sort((a, b) => a.localeCompare(b));
    sockets.forEach((socket: Socket<SocketEvents>) => {
      socket.emit('prices', filterPrices(socket.data.filters));
      socket.emit('pairs', sortedPairs);
    });
  });

  io.on('connection', (socket) => {
    socket.data.filters = [];
    socket.on('filter', (filters: string[]) => {
      socket.data.filters = filters;
      socket.emit('prices', filterPrices(filters));
    });
    socket.emit('pairs', sortedPairs);
    socket.emit('prices', filterPrices(socket.data.filters));
    sockets.set(socket.id, socket);
  });

  io.on('disconnecting', (socket) => {
    sockets.delete(socket.id);
  });

  return io.listen(3000);
}
