import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { ethers } from 'ethers';
import { generateRandomAddress } from '../test/test-utils';
import { buildMerkleTree, Value, Values } from './';

describe('buildMerkleTree', () => {
  it('should build a merkle tree from values', () => {
    const value1: Value = {
      recipient: generateRandomAddress(),
      lowThreshold: { value: 100, unit: 'ether' },
      highThreshold: { value: 200, unit: 'ether' },
    };
    const value2: Value = {
      recipient: generateRandomAddress(),
      lowThreshold: { value: 300, unit: 'gwei' },
      highThreshold: { value: 400, unit: 'gwei' },
    };
    const values: Values = [value1, value2];

    const tree = buildMerkleTree(values);

    expect(tree).toBeInstanceOf(StandardMerkleTree);

    for (const [index, entry] of tree.entries()) {
      const value = values[index];
      expect([
        value.recipient,
        ethers.utils.parseUnits(value.lowThreshold.value.toString(), value.lowThreshold.unit),
        ethers.utils.parseUnits(value.highThreshold.value.toString(), value.highThreshold.unit),
      ]).toEqual(expect.arrayContaining(entry));
    }
  });

  it('should parse value units correctly', () => {
    const expectedRecipient = generateRandomAddress();
    const values: Values = [
      {
        recipient: expectedRecipient,
        lowThreshold: { value: 500, unit: 'szabo' },
        highThreshold: { value: 600, unit: 'szabo' },
      },
    ];

    const tree = buildMerkleTree(values);

    const treeValues = tree.dump().values;
    expect(treeValues).toHaveLength(1);

    const [recipient, lowThreshold, highThreshold] = treeValues[0].value;

    expect(recipient).toBe(expectedRecipient);
    expect(lowThreshold.toString()).toBe(ethers.utils.parseUnits('500', 'szabo').toString());
    expect(highThreshold.toString()).toBe(ethers.utils.parseUnits('600', 'szabo').toString());
  });
});
