import { v4 as uuid } from 'uuid';
import { Server, Socket } from 'socket.io';
import express, { Server as ExpressServer } from 'express';
import * as http from 'http';
import { MultipoolPriceConsumer } from '../server/consumers/multipool-price-consumer';
import { PoolDeltas } from '../server/block-processor/types';
import { FrontendPoolDeltas, SocketEvents } from '../server/socket-server/types';


const server = express();
const port = process.env.PORT || 3000;

server.get('/api/health-check', (req, res) => {
  res.status(200).send('OK');
});

let poolDeltasState: {[key: string]: PoolDeltas} = {};
let sortedPairs: string[] = [];

const sockets = new Map<string, Socket<SocketEvents>>();

function filterPrices(filters: string[]): FrontendPoolDeltas {
  return Object.entries(poolDeltasState).filter(([pair]) => {
    for (const filter of filters) {
      if (!pair.includes(filter)) {
        return false;
      }
    }
    return true;
  });
}

export async function socketServer(
  multiPoolPriceConsumer: MultipoolPriceConsumer,
): Promise<ExpressServer> {
  const httpServer = http.createServer(server);
  const io = new Server<SocketEvents>(httpServer, {
    cors: {
      origin: ['*'],
      methods: ['GET', 'POST', 'OPTIONS'],
      preflightContinue: true,
    },
    httpCompression: true,
  });

  multiPoolPriceConsumer.registerListener(uuid(), (poolDeltas: { [key: string]: PoolDeltas }) => {
    poolDeltasState = poolDeltas;
    sortedPairs = Object.keys(poolDeltasState).sort((a, b) => a.localeCompare(b));
    sockets.forEach((socket: Socket<SocketEvents>) => {
      socket.emit('deltas', filterPrices(socket.data.filters));
      socket.emit('pairs', sortedPairs);
    });
  });

  io.on('connection', (socket) => {
    socket.data.filters = [];
    socket.on('filter', (filters: string[]) => {
      socket.data.filters = filters;
      socket.emit('deltas', filterPrices(filters));
    });
    socket.emit('pairs', sortedPairs);
    socket.emit('deltas', filterPrices(socket.data.filters));
    sockets.set(socket.id, socket);
  });

  io.on('disconnecting', (socket) => {
    sockets.delete(socket.id);
  });

  return httpServer.listen(port);
}
