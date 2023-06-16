import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { Values } from '.';
import { ethers } from 'ethers';

function buildMerkleTree(values: Values) {
  const treeValues = values.map(({ recipient, lowThreshold, highThreshold }) => [
    recipient,
    ethers.utils.parseUnits(lowThreshold.value.toString(), lowThreshold.unit),
    ethers.utils.parseUnits(highThreshold.value.toString(), highThreshold.unit),
  ]);
  const tree = StandardMerkleTree.of(treeValues, ['address', 'uint256', 'uint256']);
  return tree;
}

export default buildMerkleTree;
