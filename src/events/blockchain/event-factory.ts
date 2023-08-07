import { Sync } from './sync';
import { AbstractEvent } from './abstract-event';
import { Swap } from './swap';
import { EventArgs, EventSignature } from './types';
import { PairCreated } from './pair-created';

class ChainEventFactory {
  getEvent<T extends AbstractEvent>(signature: string | symbol, args: EventArgs): T {
    switch (signature) {
      case EventSignature.Sync:
        return new Sync(args.pair, args.log, args.parsedLog) as unknown as T;
      case EventSignature.SwapV3:
        return new Swap(args.pair, args.log, args.parsedLog) as unknown as T;
      case EventSignature.PairCreated:
        return new PairCreated(args.pair, args.log, args.parsedLog) as unknown as T;
      default:
        throw Error('No event with such signature');
    }
  }
}

export const EventFactory = new ChainEventFactory();


