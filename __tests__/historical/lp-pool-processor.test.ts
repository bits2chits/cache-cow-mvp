import {FormatType, LogDescription, Result} from "ethers"
import {uuidV4} from "web3-utils"
import {PairCreated} from "../../src/events/blockchain/pair-created"
import {AbstractEvent} from "../../src/events/blockchain/abstract-event"

class TestEvent extends AbstractEvent {
  constructor(log: LogDescription) {
    super([], log)
  }

  toJSON(): object {
    return {
      ...this.log
    }
  }
}
describe('Tests LP Pool Processor', () => {
  const log: LogDescription = {
    fragment: {
      topicHash: "", format: (_?: FormatType): string => "", type: "event", name: "name", inputs: [], anonymous: true
    },
    name: 'PairCreated(address,address,address,uint256)',
    signature: '0x5678',
    topic: '0x1234',
    args: new Result("token0", "token1", "pair", 1)
  }

  it("should map event correctly", () => {
    const event = new PairCreated(log)
    expect(event.get("key")).toEqual("token0:token1:pair:1")
    expect(JSON.stringify(event)).toEqual(JSON.stringify({
      token0: "token0",
      token0Symbol: undefined,
      token0Decimals: undefined,
      token1: "token1",
      token1Symbol: undefined,
      token1Decimals: undefined,
      pair: "pair",
      pairIndex: 1
    }))
  })
  it("should set value on event", () => {
    const event = new PairCreated(log)
    expect(event.get("key")).toEqual("token0:token1:pair:1")
    const newKey = uuidV4()
    event.set("key", newKey)
    expect(event.get("key")).toEqual(newKey)
  })
  it("should throw for when passing invalid ABI to Event", () => {
    expect(() => new TestEvent(log))
      .toThrow("Invalid ABI passed to constructor. Ensure that the ABI has an event definition for event TestEvent with 4 arguments.")
  })
})
