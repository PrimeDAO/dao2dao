/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/

// SPDX-License-Identifier: GPL-3.0-or-Collateral
/* solhint-disable space-after-comma */
pragma solidity 0.5.13;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/Controller.sol";
import "@gnosis.pm/conditional-tokens-contracts/contracts/ConditionalTokens.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/introspection/ERC165.sol";
import "../Oracle.sol";


/*
* @title CtfTreasury
* @dev contract for DAOs and non-ERC1155Reciever contracts to interface with Conditional
* Tokens Framework. Contract also holds Conditional Tokens for these contracts.
* Many of the require statements have been forked from the Conditional Tokens framework
* for easier error checking in the event of a tx revert.
*/
contract CtfTreasury is ERC165 {

    using SafeMath for uint256;

    bool               public initialized;
    Avatar             public avatar;
    ConditionalTokens  public conditionalTokens;
    Oracle             public oracle;

    uint   public _binaryOutcomeSlots = 2;
    uint[] public _binaryIndexSets    = [1,2];
    uint[] public _binaryPartition    = [1,2];
    uint   public fee;

    uint32  public constant PPM    = 1000000;   // parts per million
    uint256 public constant PPM100 = 100000000; // ppm * 100

    event RedeemSuccess(
        bytes32 indexed conditionId,
        address indexed payee,
        uint256 payeeAmount,
        address avatar,
        uint256 feeAmount
        );

    event RedeemFail(
        bytes32 indexed conditionId,
        uint256 payeeAmount,
        address avatar
        );

    event FeeSet(
        uint256 indexed fee
    );

    event OracleSet(
        address indexed oracle
    );

    modifier initializer() {
        require(!initialized, "CtfTreasury: treasury already initialized");
        initialized = true;
        _;
    }

    modifier protected() {
        require(initialized, "CtfTreasury: contract not initialized");
        require(msg.sender == address(avatar), "CtfTreasury: protected operation");
        _;
    }

    modifier checkOracle() {
        require(oracle != Oracle(0), "CtfTreasury: oracle not set");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == address(oracle), "CtfTreasury: caller must be oracle");
        _;
    }

    /**
    * @dev                        Initialize contract.
    * @param _avatar              PrimeDAO Avatar contract.
    * @param _conditionalTokens   Conditional Tokens contract.
    */
    function initialize(
        Avatar _avatar,
        ConditionalTokens _conditionalTokens,
        uint _fee
        ) external initializer {
        require(_avatar != Avatar(0),                       "CtfTreasury: avatar cannot be null");
        require(_conditionalTokens != ConditionalTokens(0), "CtfTreasury: conditionalTokens cannot be null");
        avatar = _avatar;
        conditionalTokens = _conditionalTokens;
        fee = _fee;
    }

    /**
    * @dev                        Set a new fee.
    * @param _newFee              New fee as a percentage of successful collaborations.
    */
    function setFee(uint _newFee) external protected {
        fee = _newFee;
        emit FeeSet(fee);
    }

    /**
    * @dev                        Set a new Oracle contract.
    * @param _oracle              The new Oracle contract used for reporting on conditions.
    */
    function setOracle(Oracle _oracle) external protected {
        require(_oracle != Oracle(0), "CtfTreasury: oracle cannot be null");
        oracle = _oracle;
        emit OracleSet(address(oracle));
    }

    /**
    * @dev                  Sets or unsets the approval of a given operator. An operator is allowed to
    *                       transfer all tokens of the sender on their behalf.
    * @param operator       Address to set the approval
    * @param approved       Representing the status of the approval to be set
    */
    function setApproval(address operator, bool approved) external {
        conditionalTokens.setApprovalForAll(operator,approved);
    }

    /**
    * @dev
    * @param _oracle              The account assigned to report the result for the prepared condition.
    * @param _questionId          An identifier for the question to be answered by the oracle.
    * @param _collateralToken     The address of the positions' backing collateral token.
    * @param _parentCollectionId  The ID of the outcome collections common to the position being split and
    *                             the split target positions. May be null, in which only the collateral is shared.
    * @param _timeLockFinish      Unix timestamp after which the question can be answered.
    */
    function createBinaryCondition(
        address _oracle,
        bytes32 _questionId,
        bytes32 _parentCollectionId,
        IERC20  _collateralToken,
        uint256 _timeLockFinish
        ) external checkOracle {
        require(_timeLockFinish != 0, "CtfTreasury: timeLockFinish cannot be null");
        require(
            _timeLockFinish > block.timestamp,
            "CtfTreasury: timeLockFinish must be greater than current block.timestamp"
        );
        // prepare condition
        conditionalTokens.prepareCondition(_oracle, _questionId, _binaryOutcomeSlots);
        // get condition id
        bytes32 conditionId = conditionalTokens.getConditionId(_oracle, _questionId, _binaryOutcomeSlots);
        for (uint i = 0; i < _binaryIndexSets.length; i++) {
            bytes32 collectionID = conditionalTokens.getCollectionId(
                _parentCollectionId,
                conditionId,
                _binaryIndexSets[i]
            );
            conditionalTokens.getPositionId(_collateralToken, collectionID);
        }
        // registerCondition success condition to check balance of with oracle
        bytes32 collectionID = conditionalTokens.getCollectionId(_parentCollectionId, conditionId, 1);
        uint256 positionId = conditionalTokens.getPositionId(_collateralToken, collectionID);
        // fill amount & joint venture with empty info
        oracle.registerQuestion(msg.sender, _questionId, _timeLockFinish, positionId, 0, address(0));
    }

    /**
    * @dev
    * @param _oracle              The account assigned to report the result for the prepared condition.
    * @param _questionId          An identifier for the question to be answered by the oracle.
    * @param _parentCollectionId  The ID of the outcome collections common to the position being split and
    *                             the split target positions. May be null, in which only the collateral is shared.
    * @param _collateralToken     The address of the positions' backing collateral token.
    * @param _amount              The amount of collateral or stake to split.
    * @param _timeLockFinish      Unix timestamp after which the question can be answered.
    * @param _jv                  The address of the joint venture wallet.
    */
    function splitBinaryCondition(
        address _oracle,
        bytes32 _questionId,
        bytes32 _parentCollectionId,
        IERC20  _collateralToken,
        uint256 _amount,
        uint256 _timeLockFinish,
        address _jv
        ) external checkOracle {
        require(_timeLockFinish != 0, "CtfTreasury: timeLockFinish cannot be null");
        require(
            _timeLockFinish > block.timestamp,
            "CtfTreasury: timeLockFinish must be greater than current block.timestamp"
        );
        // get condition id
        bytes32 conditionId = conditionalTokens.getConditionId(_oracle, _questionId, _binaryOutcomeSlots);
        // if shallow position
        if (_parentCollectionId == bytes32(0)) {
            // pull collateral in
            IERC20(_collateralToken).transferFrom(msg.sender, address(this), _amount);
            // approve erc20 transfer to conditional tokens contract
            IERC20(_collateralToken).approve(address(conditionalTokens), _amount);
        }
        // splitPosition
        conditionalTokens.splitPosition(_collateralToken, _parentCollectionId, conditionId, _binaryPartition, _amount);
        // registerCondition success condition to check balance of with oracle
        bytes32 collectionID = conditionalTokens.getCollectionId(_parentCollectionId, conditionId, 1);
        uint256 positionId = conditionalTokens.getPositionId(_collateralToken, collectionID);
        oracle.registerQuestion(msg.sender, _questionId, _timeLockFinish, positionId, _amount, _jv);
    }

    /**
    * @dev
    * @param _questionId          An identifier for the question to be answered by the oracle.
    * @param _parentCollectionId  The ID of the outcome collections common to the position being split and
    *                             the split target positions. May be null, in which only the collateral is shared.
    * @param _collateralToken     The address of the positions' backing collateral token.
    * @param _conditionId         The ID of the condition to split on.
    * @param _jv                  The address of the joint venture wallet.
    */
    function redeemPositions(
        IERC20  _collateralToken,
        bytes32 _parentCollectionId,
        bytes32 _conditionId,
        bool    _success,
        address _dao,
        address _jv,
        uint256 _balance
        ) external onlyOracle {
        if (_success == true) {
            conditionalTokens.redeemPositions(_collateralToken, _parentCollectionId, _conditionId, _binaryIndexSets);
            if (_parentCollectionId == bytes32(0)) {
                uint256 balanceMinusFee = _balance - (_balance.mul(uint(PPM))).mul(fee).div(PPM100);
                uint256 feeAmount = (_balance.mul(uint(PPM))).mul(fee).div(PPM100);
                require(
                    _collateralToken.transfer(_jv, balanceMinusFee),
                    "CtfTreasury: could not transfer payout to jv"
                );
                require(
                    _collateralToken.transfer(address(avatar), feeAmount),
                    "CtfTreasury: could not transfer fee to avatar"
                );
                emit RedeemSuccess(_conditionId, _jv, balanceMinusFee, address(avatar), feeAmount);
            }
        } else {
            conditionalTokens.redeemPositions(_collateralToken, _parentCollectionId, _conditionId, _binaryIndexSets);
            if (_parentCollectionId == bytes32(0)) {
                require(
                    _collateralToken.transfer(_dao, _balance),
                    "CtfTreasury: could not transfer payout to message sender"
                );
                emit RedeemFail(_conditionId, _balance, address(avatar));
            }
        }
    }

    /**
    * @dev                        This function allows governance to take unsupported tokens out of the
                                  contract, since this one exists longer than the other pools.
                                  This is in an effort to make someone whole, should they seriously
                                  mess up. There is no guarantee governance will vote to return these.
                                  It also allows for removal of airdropped tokens.
    * @param _token               The .
    * @param _amount              The .
    */
    function rescueTokens(address _token, uint256 _amount, address to) external protected {
        IERC20(_token).transfer(to, _amount);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes   calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address   operator,
        address   from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes     calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }


}
