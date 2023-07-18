import {createConsumer, createProducer} from "../src/kafka"
import {uuidV4} from "web3-utils"

const TEST_TOPIC = 'test-topic'

describe('Tests Kafka', () => {
  beforeEach((): void => {
    jest.setTimeout(100000);
  });
  it('should connect to broker', async () => {
    const producer = createProducer()
    await expect(producer.connect()).resolves.not.toThrow()
  })
  it('should produce a kafka message', async () => {
    const messageValue = uuidV4()
    const producer = createProducer()
    await producer.connect()
    await producer.send({
      topic: TEST_TOPIC,
      messages: [{
        value: messageValue
      }]
    })

    const consumer = createConsumer({groupId: 'test-group'})
    await consumer.connect()
    await consumer.subscribe({topic: TEST_TOPIC, fromBeginning: true})
    await consumer.run({
      eachMessage: async ({message}) => {
        console.log(message.value)
      }
    })
  })
});
