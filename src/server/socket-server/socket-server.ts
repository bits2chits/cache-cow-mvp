import { v4 as uuid } from 'uuid';
import { Server, Socket } from 'socket.io';
import { FrontendPriceEntries, SocketEvents } from './types';
import express, { Server as ExpressServer } from 'express';
import { PriceAggregateProcessor } from '../processors/price-aggregate-processor';
import { PricesMap } from '../processors/types';
import * as http from 'http';


const server = express();
const port = process.env.PORT || 3000;

server.get('/api/health-check', (req, res) => {
  res.status(200).send('OK');
});

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
): Promise<ExpressServer> {
  const httpServer = http.createServer(server);
  const io = new Server<SocketEvents>(httpServer, {
    cors: {
      origin: ['https://mvp.cachecow.io'],
      methods: ['GET', 'POST', 'OPTIONS'],
      preflightContinue: true,
    },
    httpCompression: true,
  });

  priceAggregateProcessor.registerListener(uuid(), (prices: PricesMap) => {
    priceState = prices;
    sortedPairs = Array.of(...new Set(Object.values(prices)
      .flatMap((p) => [p.token0, p.token1])
      .sort((a, b) => a.localeCompare(b))));
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

  return httpServer.listen(port);
}
