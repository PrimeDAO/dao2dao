/*global artifacts, web3, contract, before, it, context*/
/*eslint no-undef: "error"*/

const { expect } = require('chai');
const { constants, time, expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const helpers = require('./helpers');
const CtfTreasury = artifacts.require('CtfTreasury');
const ERC1155Mock = artifacts.require('ERC1155Mock');

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

contract('CtfTreasury', (accounts) => {
    let setup;
    let fee;
    let fundMinusFee;
    let mockAmount;
    let treasuryMock;
    let conditionalMock;
    let conditionID;
    let conditionID2;
    let conditionID3;
    let conditionID4;
    const questionID =  '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc1234';
    const questionID2 = '0xcababcabcabcabcabcabcabcabcabcabcbacabcabcabcabcabcabcabcabc1234';
    const questionID3 = '0xabbaccabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc1234';
    const questionID4 = '0xabcabcabcabcabcabcabcabcabcabbaccabcabcabcabcabcabcabcabcabc1234';
    let fundAmount;
    let calldata;
    let timeLockFinish;

    before('!! deploy setup', async () => {
        setup = await deploy(accounts);
        fee = 2;
        fundAmount = toWei('100');
        fundMinusFee = toWei('98');
        timeLockFinish = 1619868707; //Sat May 01 2021 11:31:47 GMT+0000
    });
    context('» treasury is not initialized yet', () => {
        context('» parameters are valid', () => {
            // treasury has already been initialized during setup
            it('it initializes treasury', async () => {
                expect(await setup.ctf.treasury.initialized()).to.equal(true);
                expect(await setup.ctf.treasury.avatar()).to.equal(setup.organization.avatar.address);
                expect(await setup.ctf.treasury.conditionalTokens()).to.equal(setup.tokens.conditionalTokens.address);
                expect((await setup.ctf.treasury.fee()).toNumber()).to.equal(fee);
            });
        });
        context('» avatar parameter is not valid', () => {
            before('!! deploy treasury', async () => {
                setup.data.treasury = await CtfTreasury.new();
            });
            it('it reverts', async () => {
                await expectRevert(setup.data.treasury.initialize(constants.ZERO_ADDRESS, setup.tokens.conditionalTokens.address, fee), 'CtfTreasury: avatar cannot be null');
            });
        });
        context('» conditionalTokens parameter is not valid', () => {
            before('!! deploy treasury', async () => {
                setup.data.treasury = await CtfTreasury.new();
            });
            it('it reverts', async () => {
                await expectRevert(setup.data.treasury.initialize(setup.organization.avatar.address, constants.ZERO_ADDRESS, fee), 'CtfTreasury: conditionalTokens cannot be null');
            });
        });
    });
    context('» treasury is already initialized', () => {
        // treasury has already been initialized during setup
        it('it reverts', async () => {
            await expectRevert(setup.ctf.treasury.initialize(setup.organization.avatar.address, setup.tokens.conditionalTokens.address, fee), 'CtfTreasury: treasury already initialized');
        });
    });
    context('» it can recieve ERC1155 tokens', () => {
        before('!! deploy with treasuryMock as conditionalToken param', async () => {
            conditionalMock = await ERC1155Mock.new();
            treasuryMock = await CtfTreasury.new();
            await treasuryMock.initialize(setup.organization.avatar.address, conditionalMock.address, fee);
        });
        it('successfully recieves tokens', async () => {
            mockAmount = 10;
            await conditionalMock.mint(treasuryMock.address, 1, mockAmount, "0x");
            expect((await conditionalMock.balanceOf(treasuryMock.address, 1)).toString()).to.equal(mockAmount.toString());
        });
    });
    context('# setOracle', () => {
        context('» generics', () => {
            it('oracle cannot be null', async () => {
                calldata = helpers.encodeSetOracle(constants.ZERO_ADDRESS);
                let _tx = await setup.DAO1.ctfManager.proposeCalls(
                    [setup.ctf.treasury.address],
                    [calldata],
                    [0],
                    constants.ZERO_BYTES32
                );
                var proposalId = await helpers.getNewProposalId(_tx);
                await setup.DAO1.ctfManager.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
                await expectRevert(
                    setup.DAO1.ctfManager.execute(proposalId),
                    "Proposal call failed"
                );
            });
            it('can only be set by oracle', async () => {
                await expectRevert(
                    setup.ctf.treasury.setOracle(setup.oracle.address),
                    "CtfTreasury: protected operation"
                );
            });
            it('sets oracle', async () => {
                calldata = helpers.encodeSetOracle(setup.oracle.address);
                let _tx = await setup.DAO1.ctfManager.proposeCalls(
                    [setup.ctf.treasury.address],
                    [calldata],
                    [0],
                    constants.ZERO_BYTES32
                );
                var proposalId = await helpers.getNewProposalId(_tx);
                await setup.DAO1.ctfManager.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
                let tx = await setup.DAO1.ctfManager.execute(proposalId);
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.ctf.treasury, 'OracleSet', {
                    oracle: setup.oracle.address
                });
            });
        });
    });
    context('# createAndSplitBinaryCondition', () => {
        context('» generics', () => {
            it('timeLockFinish cannot be null -- createBinaryCondition', async () => {
                await expectRevert(
                    setup.ctf.treasury.createBinaryCondition(
                        setup.oracle.address,
                        questionID,
                        constants.ZERO_BYTES32,
                        setup.tokens.primeToken.address,
                        0,
                    ), "CtfTreasury: timeLockFinish cannot be null");
            });
            it('timeLockFinish must be greater than current blocktime -- createBinaryCondition', async () => {
                let blocktime = new BN(await time.latest());
                await expectRevert(
                    setup.ctf.treasury.createBinaryCondition(
                        setup.oracle.address,
                        questionID,
                        constants.ZERO_BYTES32,
                        setup.tokens.primeToken.address,
                        blocktime,
                    ), "CtfTreasury: timeLockFinish must be greater than current block.timestamp");
            });
            it('prepares a shallow binary condition', async () => {
                await setup.tokens.primeToken.approve(setup.ctf.treasury.address, fundAmount);
                let tx = await setup.ctf.treasury.createBinaryCondition(
                    setup.oracle.address,
                    questionID,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    timeLockFinish,
                );
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.conditionalTokens, 'ConditionPreparation');
                await expectEvent.inTransaction(setup.data.tx.tx, setup.oracle, 'QuestionRegistered', {
                    _questionId: questionID,
                    _timeLockFinish: timeLockFinish.toString(),
                    _dao: accounts[0],
                    _balance: '0',
                    _jv: constants.ZERO_ADDRESS
                });
            });
            it('timeLockFinish cannot be null -- splitBinaryCondition', async () => {
                await expectRevert(
                    setup.ctf.treasury.splitBinaryCondition(
                        setup.oracle.address,
                        questionID,
                        constants.ZERO_BYTES32,
                        setup.tokens.primeToken.address,
                        fundAmount,
                        0,
                        accounts[2]
                    ), "CtfTreasury: timeLockFinish cannot be null");
            });
            it('timeLockFinish must be greater than current blocktime -- splitBinaryCondition', async () => {
                let blocktime = new BN(await time.latest());
                await expectRevert(
                    setup.ctf.treasury.splitBinaryCondition(
                        setup.oracle.address,
                        questionID,
                        constants.ZERO_BYTES32,
                        setup.tokens.primeToken.address,
                        fundAmount,
                        blocktime,
                        accounts[2]
                    ), "CtfTreasury: timeLockFinish must be greater than current block.timestamp");
            });
            it('splits a shallow binary condition', async () => {
                let tx = await setup.ctf.treasury.splitBinaryCondition(
                    setup.oracle.address,
                    questionID,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    fundAmount,
                    timeLockFinish,
                    accounts[2]
                );
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.conditionalTokens, 'PositionSplit');
                await expectEvent.inTransaction(setup.data.tx.tx, setup.oracle, 'QuestionRegistered', {
                    _questionId: questionID,
                    _timeLockFinish: timeLockFinish.toString(),
                    _dao: accounts[0],
                    _balance: fundAmount,
                    _jv: accounts[2]
                });
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.primeToken, 'Transfer', {
                    from: setup.ctf.treasury.address,
                    to: setup.tokens.conditionalTokens.address,
                    value: fundAmount
                });

                // prepare and split another condition to emulate how it would work IRL
                await setup.ctf.treasury.createBinaryCondition(
                    setup.oracle.address,
                    questionID2,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    timeLockFinish,
                );
                await setup.tokens.primeToken.approve(setup.ctf.treasury.address, fundAmount);
                tx = await setup.ctf.treasury.splitBinaryCondition(
                    setup.oracle.address,
                    questionID2,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    fundAmount,
                    timeLockFinish,
                    accounts[2]
                );
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.primeToken, 'Transfer', {
                    from: setup.ctf.treasury.address,
                    to: setup.tokens.conditionalTokens.address,
                    value: fundAmount
                });
            });
        });
    });
    context('# redeemPositions', () => {
        context('» generics', () => {
            before('!! fast forward & transfer conditional tokens => accounts[2]', async () => {
                await setup.ctf.treasury.setApproval(accounts[0],true);
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
                await setup.tokens.conditionalTokens.safeTransferFrom(setup.ctf.treasury.address, accounts[2], successPositionId, fundAmount, "0x");
            });
            it('only oracle can redeem positions', async () => {
                await expectRevert(
                    setup.ctf.treasury.redeemPositions(
                        setup.tokens.primeToken.address,
                        constants.ZERO_BYTES32,
                        conditionID,
                        true,
                        setup.organization.avatar.address,
                        accounts[2],
                        fundAmount
                    ), "CtfTreasury: caller must be oracle"
                );
            });
            it('redeems successful shallow conditions', async () => {
                await time.increase(time.duration.days(9));
                conditionID2 = await web3.utils.soliditySha3({
                    t: 'address',
                    v: setup.oracle.address
                }, {
                    t: 'bytes32',
                    v: questionID2
                }, {
                    t: 'uint',
                    v: 2
                });

                let collectionID = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID);
                let collectionID2 = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID2, 1);
                let successPositionId2 = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID2);

                await setup.tokens.conditionalTokens.safeTransferFrom(setup.ctf.treasury.address, accounts[2], successPositionId2, fundAmount, "0x");

                let tx = await setup.oracle.checkBalance(
                    [setup.tokens.primeToken.address, setup.tokens.primeToken.address],
                    [constants.ZERO_BYTES32, constants.ZERO_BYTES32],
                    [successPositionId, successPositionId2]
                );
                setup.data.tx = tx;

                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.conditionalTokens, 'ConditionResolution');
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.conditionalTokens, 'PayoutRedemption',{
                    redeemer: setup.ctf.treasury.address,
                    collateralToken: setup.tokens.primeToken.address,
                    parentCollectionId: constants.ZERO_BYTES32,
                    conditionId: conditionID,
                    payout: fundAmount
                });
                await expectEvent.inTransaction(setup.data.tx.tx, setup.ctf.treasury, 'RedeemSuccess', {
                    conditionId: conditionID,
                    payee: accounts[2],
                    payeeAmount: fundMinusFee.toString(),
                    avatar: setup.organization.avatar.address,
                    feeAmount: toWei('2')
                });
            });
            it('redeems a successful shallow condition -- funds PrimeDAO with a fee', async () => {
                expect((await setup.tokens.primeToken.balanceOf(setup.organization.avatar.address)).toString()).to.equal(toWei('4'));
            });
            it('redeems a successful shallow condition -- funds a jv with collateral', async () => {
                await expect((await setup.tokens.primeToken.balanceOf(accounts[2])).toString()).to.equal((fundMinusFee*2).toString()); // fund is * 2 because its fee from both DAOs
            });
            it('redeems a failing shallow condition', async () => {
                timeLockFinish = 1620983378; //Fri May 14 2021 09:09:38 GMT+0000

                await setup.tokens.primeToken.approve(setup.ctf.treasury.address, fundAmount);
                await setup.ctf.treasury.createBinaryCondition(
                    setup.oracle.address,
                    questionID3,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    timeLockFinish,
                );
                await setup.ctf.treasury.splitBinaryCondition(
                    setup.oracle.address,
                    questionID3,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    fundAmount,
                    timeLockFinish,
                    accounts[2]
                );

                await setup.tokens.primeToken.approve(setup.ctf.treasury.address, fundAmount);
                await setup.ctf.treasury.createBinaryCondition(
                    setup.oracle.address,
                    questionID4,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    timeLockFinish,
                );
                await setup.ctf.treasury.splitBinaryCondition(
                    setup.oracle.address,
                    questionID4,
                    constants.ZERO_BYTES32,
                    setup.tokens.primeToken.address,
                    fundAmount,
                    timeLockFinish,
                    accounts[2]
                );

                await time.increase(time.duration.days(9));
                conditionID3 = await web3.utils.soliditySha3({
                    t: 'address',
                    v: setup.oracle.address
                }, {
                    t: 'bytes32',
                    v: questionID3
                }, {
                    t: 'uint',
                    v: 2
                });
                conditionID4 = await web3.utils.soliditySha3({
                    t: 'address',
                    v: setup.oracle.address
                }, {
                    t: 'bytes32',
                    v: questionID4
                }, {
                    t: 'uint',
                    v: 2
                });

                let collectionID3 = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID3, 1);
                let successPositionId = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID3);
                let collectionID4 = await setup.tokens.conditionalTokens.getCollectionId(constants.ZERO_BYTES32, conditionID4, 1);
                let successPositionId2 = await setup.tokens.conditionalTokens.getPositionId(setup.tokens.primeToken.address, collectionID4);

                let tx = await setup.oracle.checkBalance(
                    [setup.tokens.primeToken.address, setup.tokens.primeToken.address],
                    [constants.ZERO_BYTES32, constants.ZERO_BYTES32],
                    [successPositionId, successPositionId2]
                );

                setup.data.tx = tx;

                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.conditionalTokens, 'ConditionResolution');
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.conditionalTokens, 'PayoutRedemption');
                await expectEvent.inTransaction(setup.data.tx.tx, setup.ctf.treasury, 'RedeemFail');
                // expect transfer event to dao
            });
        });
    });
    context('# setFee', () => {
        context('» generics', () => {
            it('only Avatar can call setFee', async () => {
                let fee = 4;
                await expectRevert(
                    setup.ctf.treasury.setFee(fee),
                    'CtfTreasury: protected operation'
                );
            });
            it('sets new fee', async () => {
                let fee = 4;
                calldata = helpers.encodeSetFee(fee);
                let _tx = await setup.DAO1.ctfManager.proposeCalls(
                    [setup.ctf.treasury.address],
                    [calldata],
                    [0],
                    constants.ZERO_BYTES32
                );
                var proposalId = await helpers.getNewProposalId(_tx);
                await setup.DAO1.ctfManager.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
                let tx = await setup.DAO1.ctfManager.execute(proposalId);
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.ctf.treasury, 'FeeSet', {
                    fee: fee.toString()
                });
                expect((await setup.ctf.treasury.fee()).toString()).to.equal(fee.toString());
            });
        });
    });
    context('# rescueTokens', () => {
        context('» generics', () => {
            it('only Avatar can call rescueTokens', async () => {
                await setup.tokens.primeToken.transfer(setup.ctf.treasury.address, fundAmount);
                await expectRevert(
                    setup.ctf.treasury.rescueTokens(setup.tokens.primeToken.address, fundAmount, accounts[0]),
                    'CtfTreasury: protected operation'
                );
            });
            it('recovers tokens', async () => {
                calldata = helpers.encodeRescueTokensCtf(setup.tokens.primeToken.address, fundAmount, accounts[0]);
                let _tx = await setup.DAO1.ctfManager.proposeCalls(
                    [setup.ctf.treasury.address],
                    [calldata],
                    [0],
                    constants.ZERO_BYTES32
                );
                var proposalId = await helpers.getNewProposalId(_tx);
                await setup.DAO1.ctfManager.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
                let tx = await setup.DAO1.ctfManager.execute(proposalId);
                setup.data.tx = tx;
                await expectEvent.inTransaction(setup.data.tx.tx, setup.tokens.primeToken, 'Transfer');
            });
        });
    });
});
