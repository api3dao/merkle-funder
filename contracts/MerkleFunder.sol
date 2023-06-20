// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@api3/airnode-protocol-v1/contracts/utils/SelfMulticall.sol";
import "./interfaces/IMerkleFunder.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./MerkleFunderDepository.sol";

contract MerkleFunder is SelfMulticall, IMerkleFunder {
    mapping(address => mapping(bytes32 => address payable))
        public
        override ownerToRootToMerkleFunderDepositoryAddress;

    function deployMerkleFunderDepository(
        address owner,
        bytes32 root
    ) external override returns (address payable merkleFunderDepository) {
        // Owner allowed to be zero
        require(root != bytes32(0), "Root zero");
        merkleFunderDepository = payable(
            new MerkleFunderDepository{salt: bytes32(0)}(owner, root)
        );
        ownerToRootToMerkleFunderDepositoryAddress[owner][
            root
        ] = merkleFunderDepository;
        // We could have not stored this and used computeMerkleFunderDepositoryAddress() on the
        // fly whenever we needed it, but doing so requires handling the MerkleFunderDepository
        // bytecode, which ends up being more expensive than reading a bytes32 from storage
        emit DeployedMerkleFunderDepository(
            merkleFunderDepository,
            owner,
            root
        );
    }

    // It's a bit heavy on the calldata but I don't see a way around it
    function fund(
        address owner,
        bytes32 root,
        bytes32[] calldata proof,
        address recipient,
        uint256 lowThreshold,
        uint256 highThreshold
    ) external override {
        require(recipient != address(0), "Recipient address zero");
        require(
            lowThreshold <= highThreshold,
            "Low threshold higher than high"
        );
        require(highThreshold != 0, "High threshold zero");
        // https://github.com/OpenZeppelin/merkle-tree#validating-a-proof-in-solidity
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(abi.encode(recipient, lowThreshold, highThreshold))
            )
        );
        require(MerkleProof.verify(proof, root, leaf), "Invalid proof");
        // https://en.wikipedia.org/wiki/Hysteresis#In_engineering
        uint256 recipientBalance = recipient.balance;
        require(recipientBalance <= lowThreshold, "Balance not low enough");
        address payable merkleFunderDepository = ownerToRootToMerkleFunderDepositoryAddress[
                owner
            ][root];
        require(
            merkleFunderDepository != address(0),
            "No such MerkleFunderDepository"
        );
        uint256 amountNeededToTopUp;
        unchecked {
            amountNeededToTopUp = highThreshold - recipientBalance;
        }
        uint256 amount = amountNeededToTopUp <= merkleFunderDepository.balance
            ? amountNeededToTopUp
            : merkleFunderDepository.balance;
        require(amount != 0, "Amount zero");
        MerkleFunderDepository(merkleFunderDepository).withdraw(
            recipient,
            amount
        );
        // Even though the call above is external, it is to a trusted contract so the
        // event can be emitted after it returns
        emit Funded(merkleFunderDepository, recipient, amount);
    }

    // Called by the owner
    function withdraw(
        bytes32 root,
        address recipient,
        uint256 amount
    ) public override {
        require(recipient != address(0), "Recipient address zero");
        require(amount != 0, "Amount zero");
        address payable merkleFunderDepository = ownerToRootToMerkleFunderDepositoryAddress[
                msg.sender
            ][root];
        require(
            merkleFunderDepository != address(0),
            "No such MerkleFunderDepository"
        );
        require(
            merkleFunderDepository.balance >= amount,
            "Insufficient balance"
        );
        MerkleFunderDepository(merkleFunderDepository).withdraw(
            recipient,
            amount
        );
        emit Withdrew(merkleFunderDepository, recipient, amount);
    }

    // fund() calls will keep withdrawing from MerkleFunderDepository so it may be difficult to
    // withdraw the entire balance. I provided a convenience function for that.
    function withdrawAll(bytes32 root, address recipient) external override {
        withdraw(
            root,
            recipient,
            ownerToRootToMerkleFunderDepositoryAddress[msg.sender][root].balance
        );
    }

    // This needs to be adapted for zksync but at least we've done that before for ProxyFactory
    function computeMerkleFunderDepositoryAddress(
        address owner,
        bytes32 root
    ) external view override returns (address merkleFunderDepository) {
        require(root != bytes32(0), "Root zero");
        merkleFunderDepository = Create2.computeAddress(
            bytes32(0),
            keccak256(
                abi.encodePacked(
                    type(MerkleFunderDepository).creationCode,
                    abi.encode(owner, root)
                )
            )
        );
    }
}
