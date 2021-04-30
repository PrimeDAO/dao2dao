/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/

// SPDX-License-Identifier: GPL-3.0-or-later
/* solhint-disable space-after-comma */
pragma solidity >=0.5.13;

import "@gnosis.pm/conditional-tokens-contracts/contracts/ConditionalTokens.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./schemes/CtfTreasury.sol";


/*
* @title Oracle
* @dev Automated Oracle for registering and checking Conditional Token
* amounts for PrimeDAO's CtfTreasury prototype.
*/
contract Oracle is Ownable {

    event UpdatedTimeLock(uint256 positionId, uint indexed newTimeLock);

    event QuestionRegistered(
        uint256 indexed _positionId,
        bytes32 indexed _questionId,
        uint256 _timeLockFinish,
        address _dao,
        uint256 _balance,
        address _jv
    );

    uint   public _binaryOutcomeSlots = 2;
    uint[] public _binaryIndexSets    = [1,2];
    uint[] public _binaryPartition    = [1,2];
    uint[] public _successPartition   = [0,1];
    uint[] public _failPartition      = [1,0];

    struct Questions {
        bytes32 questionId;
        uint256 timeLockFinish;
        address dao;
        uint256 balance;
        address jv;
    }

    mapping (uint256 => Questions) public daoQuestions;

    bool               public initialized;
    ConditionalTokens  public conditionalTokens;
    CtfTreasury        public ctfTreasury;

    modifier initializer() {
        require(!initialized, "Oracle: already initialized");
        initialized = true;
        _;
    }

    modifier protected() {
        require(initialized, "Oracle: not initialized");
        _;
    }

    /**
    * @dev                          Initialize contract.
    * @param _conditionalTokens     Conditional Tokens contract.
    * @param _ctfTreasury           CtfTreasury Contract.
    */
    function initialize(ConditionalTokens _conditionalTokens, CtfTreasury _ctfTreasury) external initializer {
        require(_conditionalTokens != ConditionalTokens(0), "Oracle: conditionalTokens cannot be null");
        require(_ctfTreasury != CtfTreasury(0),             "Oracle: ctfTreasury cannot be null");
        ctfTreasury = _ctfTreasury;
        conditionalTokens = _conditionalTokens;
    }

    /**
    * @dev                      Registers questions with Oracle.
    * @param _dao               Address of the DAO recieving the fee.
    * @param _questionId        The ID of the question to be answered.
    * @param _timeLockFinish    Unix timestamp after which the question can be answered.
    * @param _positionId        The ID of the success position.
    * @param _balance           The required balance of the wallet for a successful condition.
    * @param _jv                The address of the wallet to be funded.
    */
    function registerQuestion(
        address _dao,
        bytes32 _questionId,
        uint256 _timeLockFinish,
        uint256 _positionId,
        uint256 _balance,
        address _jv
        ) external protected {
        daoQuestions[_positionId] = Questions(_questionId,_timeLockFinish,_dao,_balance,_jv);
        emit QuestionRegistered(_positionId, _questionId, _timeLockFinish, _dao, _balance, _jv);
    }

    /**
    * @dev                        Checks balance of wallet and reports the success or failure of paired conditions.
    * @param _collateralToken     Array containing addresses of collateral tokens provided for conditions.
    * @param _parentCollectionId  Array containing the parentCollectionIds of the conditions to be checked.
    * @param _successPositionId   Array containing the position IDs of successful conditions.
    */
    function checkBalance(
        IERC20[] calldata  _collateralToken,
        bytes32[] calldata _parentCollectionId,
        uint256[] calldata _successPositionId
        ) external protected onlyOwner {
        require(block.timestamp >= daoQuestions[_successPositionId[0]].timeLockFinish,
            "Oracle: current timestamp < timelock"
        );
        uint jvBalanceOne = conditionalTokens.balanceOf(daoQuestions[_successPositionId[0]].jv, _successPositionId[0]);
        uint jvBalanceTwo = conditionalTokens.balanceOf(daoQuestions[_successPositionId[1]].jv, _successPositionId[1]);
        /* solhint-disable-next-line max-line-length */
        if (jvBalanceOne == daoQuestions[_successPositionId[0]].balance && jvBalanceTwo == daoQuestions[_successPositionId[1]].balance) {
            for (uint i = 0; i < _collateralToken.length; i++) {
                // derive conditionId for redeemPositions()
                bytes32 conditionId = conditionalTokens.getConditionId(
                    address(this),
                    daoQuestions[_successPositionId[i]].questionId,
                    _binaryOutcomeSlots
                    );
                // report success
                conditionalTokens.reportPayouts(daoQuestions[_successPositionId[i]].questionId, _successPartition);
                // call redeem in treasury
                ctfTreasury.redeemPositions(
                    _collateralToken[i],
                    _parentCollectionId[i],
                    conditionId,
                    true,
                    daoQuestions[_successPositionId[i]].dao,
                    daoQuestions[_successPositionId[i]].jv,
                    daoQuestions[_successPositionId[i]].balance
                    );
            }
        } else {
            for (uint i = 0; i < _collateralToken.length; i++) {
                // derive conditionId for redeemPositions()
                bytes32 conditionId = conditionalTokens.getConditionId(
                    address(this),
                    daoQuestions[_successPositionId[i]].questionId,
                    _binaryOutcomeSlots
                    );
                // report fail
                conditionalTokens.reportPayouts(daoQuestions[_successPositionId[i]].questionId, _failPartition);
                // redeem with no fee taken
                ctfTreasury.redeemPositions(
                    _collateralToken[i],
                    _parentCollectionId[i],
                    conditionId,
                    false,
                    daoQuestions[_successPositionId[i]].dao,
                    daoQuestions[_successPositionId[i]].jv,
                    daoQuestions[_successPositionId[i]].balance
                );
            }
        }
    }

    /**
    * @dev                    Increase the timelock before which a condition can be answered by the Oracle.
    * @param _newTimeLock     The new timelock as a unix timestamp.
    * @param _positionId      The position ID representing the conditions successful outcome.
    */
    function updateTimeLock(uint256 _newTimeLock, uint256 _positionId) external protected {
        require(msg.sender == daoQuestions[_positionId].jv, "Oracle: caller must be joint venture wallet for position");
        require(_newTimeLock >= block.timestamp, "Oracle: must be greater than current timestamp");
        require(
            _newTimeLock >= daoQuestions[_positionId].timeLockFinish,
            "Oracle: must be greater than current timeLock"
        );
        daoQuestions[_positionId].timeLockFinish = _newTimeLock;
        emit UpdatedTimeLock(_positionId, _newTimeLock);
    }

}
