export interface AbiInputsElement {
  indexed?: boolean
  internalType: string
  name: string
  type: string
}

export interface AbiElement {

  inputs: AbiInputsElement[],
  payable?: boolean
  stateMutability?: string
  type: string
  anonymous?: boolean
  name?: string
  constant?: boolean
  outputs?: AbiInputsElement[]
}
