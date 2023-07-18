import {createConsumer, createProducer} from "../src/kafka";
import {uuidV4} from "web3-utils";

const TEST_TOPIC = 'test-topic'

describe('Tests Kafka', () => {
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
    await consumer.subscribe({topic: TEST_TOPIC})
    const messages = []
    await consumer.run({
      eachMessage: async ({topic, partition, message}) => {
        console.log({
          topic,
          partition,
          offset: message.offset,
          value: message.value.toString()
        })
        messages.push(message.value.toString())
      }
    })
    return Promise.resolve(messages)
  })
});
