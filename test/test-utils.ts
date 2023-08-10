import { ethers } from 'ethers';
import { EvmAddress, EvmHash } from '../src/types';

export function generateRandomAddress(): EvmAddress {
  return ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20)));
}

export function generateRandomBytes32(): EvmHash {
  return ethers.utils.hexlify(ethers.utils.randomBytes(32));
}

export function generateRandomBytes(): string {
  return ethers.utils.hexlify(ethers.utils.randomBytes(256));
}
