// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./interfaces/IMerkleFunderDepository.sol";

// This contract should always be deployed by calling deployMerkleFunderDepository() at MerkleFunder.
// owner and root are immutable. If the owner wants to update the owner or the root, they can
// have a new MerkleFunderDepository deployed and call withdrawAll() at MerkleFunder to transfer the
// funds there.
contract MerkleFunderDepository is IMerkleFunderDepository {
    address public immutable override merkleFunder;
    address public immutable override owner;
    bytes32 public immutable override root;

    constructor(address _owner, bytes32 _root) {
        merkleFunder = msg.sender;
        owner = _owner;
        root = _root;
    }

    receive() external payable {}

    // MerkleFunder only uses this function to allow MerkleFunderDepository owner to withdraw funds
    // or accounts specified by the root to be funded according to the thresholds.
    // This function is omitted in the interface on purpose because it's only intended
    // to be called by MerkleFunder.
    function withdraw(address recipient, uint256 amount) external {
        require(msg.sender == merkleFunder, "Sender not MerkleFunder");
        // MerkleFunder checks for balance so MerkleFunderDepository does not need to
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer unsuccessful");
        // MerkleFunder emits event so MerkleFunderDepository does not need to
    }
}
