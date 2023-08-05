import { Sync } from './sync';
import { AbstractEvent } from './abstract-event';
import { Swap } from './swap';
import { EventArgs, EventSignature } from './types';

class ChainEventFactory {
  getEvent<T extends AbstractEvent>(signature: string | symbol, args: EventArgs): T {
    switch (signature) {
      case EventSignature.Sync:
        return new Sync(args.address, args.pair, args.log) as unknown as T;
      case EventSignature.SwapV3:
        return new Swap(args.address, args.pair, args.log) as unknown as T;
      default:
        throw Error('No event with such signature');
    }
  }
}

export const EventFactory = new ChainEventFactory();


