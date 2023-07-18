import {createConsumer, createProducer} from "../src/kafka"
import {uuidV4} from "web3-utils"

const TEST_TOPIC = 'test-topic'

let consumer, producer

describe('Tests Kafka', () => {
  beforeEach(async (): Promise<void> => {
    jest.setTimeout(100000)
    await consumer.stop()
  })
  beforeAll(async () => {
    producer = createProducer()
    // await producer.connect()
    consumer = createConsumer({groupId: 'test-group'})
    await consumer.connect()
    await consumer.subscribe({topic: TEST_TOPIC, fromBeginning: true})
  })
  afterAll(async () => {
    await producer.disconnect()
    await consumer.disconnect()
  })
  it('should connect to broker', async () => {
    await expect(producer.connect()).resolves.not.toThrow()
  })
  it('should produce a kafka message', async () => {
    const messageValue = uuidV4()
    await producer.send({
      topic: TEST_TOPIC,
      messages: [{
        value: messageValue
      }]
    })

    await consumer.run({
      eachMessage: async ({message}) => {
        expect(message.value).toEqual(messageValue)
      }
    })
  })
  it('should produce many kafka messages', async () => {
    const messages: { value: string, processed?: boolean }[] = new Array(Math.floor(Math.random() * 100)).fill({}).map((() => ({ value: uuidV4() })))
    await producer.send({
      topic: TEST_TOPIC,
      messages
    })

    await consumer.run({
      eachMessage: async ({message}) => {
        const index = messages.findIndex((m) => m.value === message)
        expect(index).toBeGreaterThan(-1)
        expect(!!messages[index].processed).toBeFalsy()
        messages[index].processed = true
      }
    })
  })
  // not sure how important it is to test the kafka packages abilities, but if we want we could test multiple topics here as well
});
