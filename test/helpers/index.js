const { BN } = require('@openzeppelin/test-helpers');
const setup = require('./setup');
const BalancerProxy = artifacts.require('BalancerProxy');
const FarmFactory = artifacts.require('FarmFactory');
// const _actionMock = artifacts.require('ActionMock');
const PrimeToken = artifacts.require('PrimeToken');
// const CTF = artifacts.require('ConditionalTokens');
const CtfTreasury = artifacts.require('CtfTreasury');


const AMOUNT = new BN('1000');
const EXPECTED = new BN('500');
const RETURNED = new BN('996');
const RETURNED2 = new BN('997');

const encodeSetPublicSwap = (publicSwap) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.setPublicSwap(publicSwap).encodeABI();
};
const encodeSetSwapFee = (swapFee) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.setSwapFee(swapFee).encodeABI();
};
const encodeCommitAddToken = (token, balance, denormalizedWeight) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.commitAddToken(token, balance, denormalizedWeight).encodeABI();
};
const encodeApplyAddToken = () => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.applyAddToken().encodeABI();
};
const encodeRemoveToken = (token) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.removeToken(token).encodeABI();
};
const encodeUpdateWeightsGradually = (newWeights, startBlock, endBlock) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.updateWeightsGradually(newWeights, startBlock, endBlock).encodeABI();
};
const encodeJoinPool = (poolAmountOut, maxAmountsIn) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.joinPool(poolAmountOut, maxAmountsIn).encodeABI();
};
const encodeExitPool = (poolAmountIn, minAmountsOut) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.exitPool(poolAmountIn, minAmountsOut).encodeABI();
};
const encodeUpdateWeight = (token, newWeight) => {
  return new web3.eth.Contract(BalancerProxy.abi).methods.updateWeight(token, newWeight).encodeABI();
};
const encodeCreateFarm = (name, rewardToken, stakingToken, initreward, starttime, duration) => {
  return new web3.eth.Contract(FarmFactory.abi).methods.createFarm(name, rewardToken, stakingToken, initreward, starttime, duration).encodeABI();
};
const encodeRescueTokens = (stakingRewards, amount, token, to) => {
  return new web3.eth.Contract(FarmFactory.abi).methods.rescueTokens(stakingRewards, amount, token, to).encodeABI();
};
const encodeIncreaseReward = (farm, amount) => {
  return new web3.eth.Contract(FarmFactory.abi).methods.increaseReward(farm, amount).encodeABI();
};


const encodeApproveERC20 = (token, spender, amount) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.approveERC20(token, spender, amount).encodeABI();
};
const encodeTransferTokens = (contract, amount) => {
  return new web3.eth.Contract(PrimeToken.abi).methods.transfer(contract, amount).encodeABI();
};
const encodePrepareCondition = (oracle, questionID, outcomeSlots) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.prepareCondition(oracle, questionID, outcomeSlots).encodeABI();
};
const encodeSplitPosition = (collateralToken, parentCollectionId, conditionId, partition, amount) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.splitPosition(collateralToken, parentCollectionId, conditionId, partition, amount).encodeABI();
};
const encodeSplitDeeperPosition = (layer1ParentCollectionId, layer1conditionId, layer1indexSet, _collateralToken, _conditionId, _partition, _amount) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.splitDeeperPosition(layer1ParentCollectionId, layer1conditionId, layer1indexSet, _collateralToken, _conditionId, _partition, _amount).encodeABI();
};
const encodeGetCollectionAndPositionIds = (parentCollectionId, conditionId, indexSet, collateralToken) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.getCollectionAndPositionIds(parentCollectionId, conditionId, indexSet, collateralToken).encodeABI();
};
const encodeGetDeeperCollectionAndPositionIds = (layer1ParentCollectionId, layer1conditionId, layer1indexSet, conditionId, indexSet, collateralToken) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.getDeeperCollectionAndPositionIds(layer1ParentCollectionId, layer1conditionId, layer1indexSet, conditionId, indexSet, collateralToken).encodeABI();
}
const encodeRedeemPositions = (collateralToken, parentCollectionId, conditionId, indexSets) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets).encodeABI();
};
const encodeSafeTransferFrom = (parentCollectionId, conditionId, indexSet, collateralToken, from, to, value, data) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.safeTransferFrom(parentCollectionId, conditionId, indexSet, collateralToken, from, to, value, data).encodeABI();
};
const encodeDeepSafeTransferFrom = (collateralToken, layer1ParentCollectionId, layer1conditionId, layer1indexSet, indexSet, conditionId, from, to, value, data) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.deepSafeTransferFrom(collateralToken, layer1ParentCollectionId, layer1conditionId, layer1indexSet, indexSet, conditionId, from, to, value, data).encodeABI();
};
const encodeSetApproval = (operator, approved) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.setApproval(operator, approved).encodeABI();
}

const encodeSetOracle = (oracle) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.setOracle(oracle).encodeABI();
};
const encodeSetFee = (fee) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.setFee(fee).encodeABI();
}
const encodeRescueTokensCtf = (amount, token, to) => {
  return new web3.eth.Contract(CtfTreasury.abi).methods.rescueTokens(amount, token, to).encodeABI();
};

const getValueFromLogs = (tx, arg, eventName, index = 0) => {
  /**
   *
   * tx.logs look like this:
   *
   * [ { logIndex: 13,
   *     transactionIndex: 0,
   *     transactionHash: '0x999e51b4124371412924d73b60a0ae1008462eb367db45f8452b134e5a8d56c8',
   *     blockHash: '0xe35f7c374475a6933a500f48d4dfe5dce5b3072ad316f64fbf830728c6fe6fc9',
   *     blockNumber: 294,
   *     address: '0xd6a2a42b97ba20ee8655a80a842c2a723d7d488d',
   *     type: 'mined',
   *     event: 'NewOrg',
   *     args: { _avatar: '0xcc05f0cde8c3e4b6c41c9b963031829496107bbb' } } ]
   */
  if (!tx.logs || !tx.logs.length) {
    throw new Error('getValueFromLogs: Transaction has no logs');
  }

  if (eventName !== undefined) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        index = i;
        break;
      }
    }
    if (index === undefined) {
      let msg = `getValueFromLogs: There is no event logged with eventName ${eventName}`;
      throw new Error(msg);
    }
  } else {
    if (index === undefined) {
      index = tx.logs.length - 1;
    }
  }
  let result = tx.logs[index].args[arg];
  if (!result) {
    let msg = `getValueFromLogs: This log does not seem to have a field "${arg}": ${tx.logs[index].args}`;
    throw new Error(msg);
  }
  return result;
};

const getNewProposalId = (tx) => {
  return getValueFromLogs(tx, '_proposalId', 'NewProposal');
};

module.exports = {
  setup,
  encodeSetPublicSwap,
  encodeSetSwapFee,
  encodeCommitAddToken,
  encodeApplyAddToken,
  encodeRemoveToken,
  encodeUpdateWeightsGradually,
  encodeUpdateWeight,
  encodeCreateFarm,
  encodeRescueTokens,
  encodeIncreaseReward,
  encodeJoinPool,
  encodeExitPool,
  getNewProposalId,
  // encodeTest2,
  // encodeWithoutReturnValue,
  encodeApproveERC20,
  encodeTransferTokens,
  encodePrepareCondition,
  encodeSplitPosition,
  encodeSplitDeeperPosition,
  encodeGetCollectionAndPositionIds,
  encodeGetDeeperCollectionAndPositionIds,
  encodeRedeemPositions,
  encodeSafeTransferFrom,
  encodeDeepSafeTransferFrom,
  encodeSetApproval,
  encodeSetOracle,
  encodeSetFee,
  encodeRescueTokensCtf,
  values: {
    AMOUNT,
    EXPECTED,
    RETURNED,
    RETURNED2,
  },
};
