const ERC20 = artifacts.require('ERC20Mock');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const GenericScheme = artifacts.require('GenericScheme');
const GenericSchemeMultiCall = artifacts.require('GenericSchemeMultiCall');
const Avatar = artifacts.require('./Avatar.sol');
const DAOToken = artifacts.require('./DAOToken.sol');
const Reputation = artifacts.require('./Reputation.sol');
const AbsoluteVote = artifacts.require('./AbsoluteVote.sol');
// const LockingToken4Reputation = artifacts.require('./LockingToken4Reputation.sol');
const PriceOracle = artifacts.require('./PriceOracle.sol');

const PrimeToken = artifacts.require('PrimeToken');


const { time, constants } = require('@openzeppelin/test-helpers');
// ctfTreasury
const CtfTreasury = artifacts.require('CtfTreasury');
const ConditionalTokens = artifacts.require('ConditionalTokens');
const Oracle = artifacts.require('Oracle');

const MAX = web3.utils.toTwosComplement(-1);

const { toWei } = web3.utils;
const { fromWei } = web3.utils;

const ARC_GAS_LIMIT = 6200000;
const INITIAL_CASH_SUPPLY = '2000000000000000000000';
const INITIAL_CASH_BALANCE = '100000000000000';
const PDAO_TOKENS = toWei('1000');
const PRIME_CAP = toWei('90000000');
const PRIME_SUPPLY = toWei('21000000');
const REPUTATION = '1000';

const deployOrganization = async (daoCreator, daoCreatorOwner, founderToken, founderReputation, cap = 0) => {
  var org = {};
  var tx = await daoCreator.forgeOrg('DAO1', 'DAO1 token', 'DAO1', daoCreatorOwner, founderToken, founderReputation, cap, { gas: constants.ARC_GAS_LIMIT });
  assert.equal(tx.logs.length, 1);
  assert.equal(tx.logs[0].event, 'NewOrg');
  var avatarAddress = tx.logs[0].args._avatar;
  org.avatar = await Avatar.at(avatarAddress);
  var tokenAddress = await org.avatar.nativeToken();
  org.token = await DAOToken.at(tokenAddress);
  var reputationAddress = await org.avatar.nativeReputation();
  org.reputation = await Reputation.at(reputationAddress);
  return org;
};

const deployOrganization2 = async (daoCreator, daoCreatorOwner, founderToken, founderReputation, cap = 0) => {
  var org = {};
  var tx = await daoCreator.forgeOrg('DAO2', 'DAO2 token', 'DAO2', daoCreatorOwner, founderToken, founderReputation, cap, { gas: constants.ARC_GAS_LIMIT });
  assert.equal(tx.logs.length, 1);
  assert.equal(tx.logs[0].event, 'NewOrg');
  var avatarAddress = tx.logs[0].args._avatar;
  org.avatar = await Avatar.at(avatarAddress);
  var tokenAddress = await org.avatar.nativeToken();
  org.token = await DAOToken.at(tokenAddress);
  var reputationAddress = await org.avatar.nativeReputation();
  org.reputation = await Reputation.at(reputationAddress);
  return org;
};

const setAbsoluteVote = async (voteOnBehalf = constants.ZERO_ADDRESS, precReq = 50) => {
  var votingMachine = {};
  votingMachine.absoluteVote = await AbsoluteVote.new();
  // register some parameters
  await votingMachine.absoluteVote.setParameters(precReq, voteOnBehalf);
  votingMachine.params = await votingMachine.absoluteVote.getParametersHash(precReq, voteOnBehalf);
  return votingMachine;
};

const initialize = async (root) => {
  const setup = {};
  setup.root = root;
  setup.data = {};
  setup.data.balances = [];
  return setup;
};

const tokens = async (setup) => {
  const erc20s = [await ERC20.new('DAI Stablecoin', 'DAI', 18), await ERC20.new('USDC Stablecoin', 'USDC', 15), await ERC20.new('USDT Stablecoin', 'USDT', 18)];

  const primeToken = await PrimeToken.new(PRIME_SUPPLY, PRIME_CAP, setup.root);

  const conditionalTokens = await ConditionalTokens.new();

  return { erc20s, primeToken, conditionalTokens};
};

const DAOStack = async () => {
  const controllerCreator = await ControllerCreator.new();
  const daoTracker = await DAOTracker.new();
  const daoCreator = await DaoCreator.new(controllerCreator.address, daoTracker.address);

  return { controllerCreator, daoTracker, daoCreator };
};

const DAOStack2 = async () => {
  const controllerCreator = await ControllerCreator.new();
  const daoTracker = await DAOTracker.new();
  const daoCreator = await DaoCreator.new(controllerCreator.address, daoTracker.address);

  return { controllerCreator, daoTracker, daoCreator };
};


const organization = async (setup) => {
  // deploy organization
  const organization = await deployOrganization(setup.DAOStack.daoCreator, [setup.root], [PDAO_TOKENS], [REPUTATION]);

  return organization;
};

const organization2 = async (setup) => {
  // deploy organization
  const organization = await deployOrganization2(setup.DAOStack2.daoCreator, [setup.root], [PDAO_TOKENS], [REPUTATION]);

  return organization;
};

const ctf = async (setup) => {
  const treasury = await CtfTreasury.new();
  await treasury.initialize(setup.organization.avatar.address, setup.tokens.conditionalTokens.address, 2);
  return { treasury };
}

const ctf2 = async (setup) => {
  const treasury = await CtfTreasury.new();
  await treasury.initialize(setup.organization2.avatar.address, setup.tokens.conditionalTokens.address, 2);
  return { treasury };
}

const oracle = async (setup) => {
  const oracle = await Oracle.new();
  await oracle.initialize(setup.tokens.conditionalTokens.address, setup.ctf.treasury.address);
  return oracle;
}

const DAO1 = async (setup) => {

  // conditional tokens manager
  const ctfManager = await GenericSchemeMultiCall.new();
  ctfManager.voting = await setAbsoluteVote(constants.ZERO_ADDRESS, 50, ctfManager.address);
  await ctfManager.initialize(setup.organization.avatar.address, ctfManager.voting.absoluteVote.address, ctfManager.voting.params, constants.ZERO_ADDRESS);


  // register schemes
  const permissions = '0x00000010';
  await setup.DAOStack.daoCreator.setSchemes(
    setup.organization.avatar.address,
    [ctfManager.address],
    [constants.ZERO_BYTES32],
    [permissions],
    'metaData'
  );

  return {ctfManager};
};

const DAO2 = async (setup) => {

  // conditional tokens manager
  const ctfManager = await GenericSchemeMultiCall.new();
  ctfManager.voting = await setAbsoluteVote(constants.ZERO_ADDRESS, 50, ctfManager.address);
  await ctfManager.initialize(setup.organization2.avatar.address, ctfManager.voting.absoluteVote.address, ctfManager.voting.params, constants.ZERO_ADDRESS);


  // register schemes
  const permissions = '0x00000010';
  await setup.DAOStack2.daoCreator.setSchemes(
    setup.organization2.avatar.address,
    [ctfManager.address],
    [constants.ZERO_BYTES32],
    [permissions],
    'metaData'
  );

  return {ctfManager};
};


module.exports = {
  initialize,
  tokens,
  DAOStack,
  DAOStack2,
  organization,
  organization2,
  ctf,
  ctf2,
  oracle,
  DAO1,
  DAO2
};
