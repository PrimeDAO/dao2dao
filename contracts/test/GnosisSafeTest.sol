pragma solidity ^0.5.0;

import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/conditional-tokens-contracts/contracts/ConditionalTokens.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/*
* quick mock for testing: properly deployed Gnosis Safe is
* already ERC1155 compliant thanks to DefaultCallbackHandler.sol,
* and able to make arbitrary function calls via its web interface
*/

/* solhint-disable max-line-length */
contract GnosisSafeTest is GnosisSafe {

    ConditionalTokens public conditionalTokens;

    function redeemPositions(ConditionalTokens _conditionalTokens, IERC20 collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint[] calldata indexSets) external {
        conditionalTokens = _conditionalTokens;
        conditionalTokens.redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

}
