
import BlockEvents from "../../src/events/node/block-events"

describe('Tests block events class', () => {
  const blockEvents = new BlockEvents()
  afterEach((): void => {
    blockEvents.cleanup()
  });
  it('test block number event', () => {
    const p = new Promise<number>((resolve) => {
      blockEvents.onNewBlock((chain, block) => {
        console.log(chain, block)
        expect(block).toEqual(5)
        expect(chain).toEqual('Polygon')
        resolve(block)
      })
    })
    blockEvents.newBlock('Polygon', 5)
    return p
  })
  it('tests block event error', () => {
    const errorMessage = 'le bloclk error'
    const p = new Promise<string>((resolve) => {
      blockEvents.onBlockError((e) => {
        console.log(e.message)
        expect(e.message).toEqual(`Error with block on Polygon chain. ${errorMessage}`)
        resolve(e.message)
      })
    })
    blockEvents.blockError('Polygon', errorMessage)
    return p
  })
  it('test block number event with multiple events', async () => {
    const p = new Promise<{ chain: string, block: number }[]>((resolve) => {
      const events: { chain: string, block: number }[] = []
      blockEvents.onNewBlock((chain, block) => {
        console.log(chain, block)
        events.push({ chain, block })
        if (events.length == 2) {
          resolve(events)
        }
      })
    })
    blockEvents.newBlock('Polygon', 5)
    blockEvents.newBlock('Harmony', 6)
    const events = await p
    expect(events[0].block).toEqual(5)
    expect(events[0].chain).toEqual('Polygon')
    expect(events[1].block).toEqual(6)
    expect(events[1].chain).toEqual('Harmony')
  })
});
