import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import * as hre from 'hardhat';
import { Values } from '.';

function buildMerkleTree(values: Values) {
  const treeValues = values.map(({ recipient, lowThreshold, highThreshold }) => [
    recipient,
    hre.ethers.utils.parseUnits(lowThreshold.value.toString(), lowThreshold.unit),
    hre.ethers.utils.parseUnits(highThreshold.value.toString(), highThreshold.unit),
  ]);
  const tree = StandardMerkleTree.of(treeValues, ['address', 'uint256', 'uint256']);
  return tree;
}

export default buildMerkleTree;
