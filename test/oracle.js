/*global artifacts, web3, contract, before, it, context*/
/*eslint no-undef: "error"*/

const { expect } = require('chai');
const { constants, time, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const helpers = require('./helpers');
const Oracle = artifacts.require('Oracle');

const { toWei } = web3.utils;

const deploy = async (accounts) => {
    // initialize test setup
    const setup = await helpers.setup.initialize(accounts[0]);
    // deploy ERC20s
    setup.tokens = await helpers.setup.tokens(setup);
    // deploy DAOStack meta-contracts
    setup.DAOStack = await helpers.setup.DAOStack(setup);
    // deploy DAOStack meta-contracts
    setup.DAOStack2 = await helpers.setup.DAOStack2(setup);
    // deploy organization
    setup.organization = await helpers.setup.organization(setup);
    // deploy organization
    setup.organization2 = await helpers.setup.organization2(setup);
    // deploy ctf proxy
    setup.ctf = await helpers.setup.ctf(setup);
    // deploy DAO1 governance
    setup.DAO1 = await helpers.setup.DAO1(setup);
    // deploy DAO1 governance
    setup.DAO2 = await helpers.setup.DAO2(setup);
    // deploy oracle
    setup.oracle = await helpers.setup.oracle(setup);

    return setup;
};

contract('Oracle', (accounts) => {
    let setup;
    const questionID = '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc1234';
    let fundAmount;
    let calldata;
    let timeLockFinish;
    let conditionID;

    before('!! deploy setup', async () => {
        setup = await deploy(accounts);
        fundAmount = toWei('100');
        timeLockFinish = 1619868707; //Sat May 01 2021 11:31:47 GMT+0000
    });
    context('» oracle is not initialized yet', () => {
        context('» parameters are valid', () => {
            // treasury has already been initialized during setup
            it('it initializes treasury', async () => {
                expect(await setup.oracle.initialized()).to.equal(true);
                expect(await setup.oracle.conditionalTokens()).to.equal(setup.tokens.conditionalTokens.address);
                expect(await setup.oracle.ctfTreasury()).to.equal(setup.ctf.treasury.address);
            });
        });
        context('» conditionalTokens parameter is not valid', () => {
            before('!! deploy treasury', async () => {
                setup.data.oracle = await Oracle.new();
            });
            it('it reverts', async () => {
                await expectRevert(setup.data.oracle.initialize(constants.ZERO_ADDRESS, setup.ctf.treasury.address), 'Oracle: conditionalTokens cannot be null');
            });
        });
        context('» ctfTreasury parameter is not valid', () => {
            before('!! deploy treasury', async () => {
                setup.data.oracle = await Oracle.new();
            });
            it('it reverts', async () => {
                await expectRevert(setup.data.oracle.initialize(setup.tokens.conditionalTokens.address, constants.ZERO_ADDRESS), 'Oracle: ctfTreasury cannot be null');
            });
        });
    });
    context('» oracle is already initialized', () => {
        // treasury has already been initialized during setup
        it('it reverts', async () => {
            await expectRevert(setup.oracle.initialize(setup.tokens.conditionalTokens.address, setup.ctf.treasury.address), 'Oracle: already initialized');
        });
    });
    context('# updateTimeLock', () => {
        context('» generics', () => {
            before('create and register condition', async () => {
                calldata = helpers.encodeSetOracle(setup.oracle.address);
                let _tx = await setup.DAO1.ctfManager.proposeCalls(
                    [setup.ctf.treasury.address],
                    [calldata],
                    [0],
                    constants.ZERO_BYTES32
                );
                var proposalId = await helpers.getNewProposalId(_tx);
                await setup.DAO1.ctfManager.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
                await setup.DAO1.ctfManager.execute(proposalId);

                await setup.tokens.primeToken.approve(setup.ctf.treasury.address, fundAmount);

                await setup.ctf.treasury.createBinaryCondition(
                    setup.oracle.address,
                    questionID,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    timeLockFinish,
                );
                await setup.ctf.treasury.splitBinaryCondition(
                    setup.oracle.address,
                    questionID,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    fundAmount,
                    timeLockFinish,
                    accounts[2]
                );
            });
            it('it updates timelock', async () => {
                const newTimeLock = 1619868907;
                conditionID = await web3.utils.soliditySha3({
                    t: 'address',
                    v: setup.oracle.address
                }, {
                    t: 'bytes32',
                    v: questionID
                }, {
                    t: 'uint',
                    v: 2
                });
                let collectionID = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID);
                let tx = await setup.oracle.updateTimeLock(newTimeLock, successPositionId, {from:accounts[2]});
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.oracle, 'UpdatedTimeLock',{
                    positionId: successPositionId,
                    newTimeLock: newTimeLock.toString()
                });
            });
            it('only jv related to condition can update timelock', async () => {
                const newTimeLock = 1619868900;
                let conditionID = await web3.utils.soliditySha3({
                    t: 'address',
                    v: setup.oracle.address
                }, {
                    t: 'bytes32',
                    v: questionID
                }, {
                    t: 'uint',
                    v: 2
                });
                let collectionID = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID);
                await expectRevert(
                    setup.oracle.updateTimeLock(newTimeLock, successPositionId),
                    'Oracle: caller must be joint venture wallet for position'
                );
            });
            it('updated timelock must be greater than current timelock', async () => {
                const newTimeLock = 1619868700;
                let collectionID = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID);
                await expectRevert(
                    setup.oracle.updateTimeLock(newTimeLock, successPositionId,{from:accounts[2]}),
                    'Oracle: must be greater than current timeLock'
                );
            });
        });
    });
    context('# checkBalances', () => {
        context('» generics', () => {
            it('can only be called if block.timestamp > timeLockFinish for position', async () => {
                let collectionID = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID);
                await expectRevert(
                    setup.oracle.checkBalance([setup.tokens.primeToken.address,setup.tokens.primeToken.address], [constants.ZERO_BYTES32,constants.ZERO_BYTES32], [successPositionId,successPositionId]),
                    'Oracle: current timestamp < timelock.'
                );
            });
            it('can only be called by the oracleOwner', async () => {
                await time.increase(time.duration.days(7));
                let collectionID = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID);
                await expectRevert(
                    setup.oracle.checkBalance([setup.tokens.primeToken.address,setup.tokens.primeToken.address], [constants.ZERO_BYTES32,constants.ZERO_BYTES32], [successPositionId,successPositionId],{from:accounts[3]}),
                    'Ownable: caller is not the owner'
                );
            });
        });
    });
});
