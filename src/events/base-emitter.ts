import { EventEmitter } from "node:events"

export enum BaseEventsEnum {}

export interface BaseEventListener<EventsEnum, Listener extends (...args: any[]) => void> {
  event: EventsEnum | (string | symbol)
  listener: Listener
}

export class BaseEventEmitter extends EventEmitter {}

export class BaseError extends Error {}

export default class BaseEvents<EventsEnum, Listener extends (...args: any[]) => void> {
  protected emitter: EventEmitter
  protected listeners: BaseEventListener<EventsEnum, Listener>[] = []

  constructor(emitter: EventEmitter) {
    this.emitter = emitter
    process.on('SIGINT', () => {
      this.cleanup()
    })
    process.on('exit', () => {
      this.cleanup()
    })
  }

  cleanup(): void {
    this.listeners.forEach(({ event, listener }) => this.emitter.off(String(event), listener))
    this.listeners = []
  }

  // just for testing purposes
  setEmitter(emitter: BaseEventEmitter): void {
    this.emitter = emitter
  }

  on(event: string | symbol, listener: Listener): void { // @TODO get rid of unused variables console.error
    this.emitter.on(event, listener)
    this.listeners.push({ event, listener })
  }
}