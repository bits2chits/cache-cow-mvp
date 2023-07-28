export interface ProcessorInterface {
  initialize: () => Promise<void>
  shutdown: () => Promise<void>
}