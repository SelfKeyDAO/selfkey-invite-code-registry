const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SelfKey Invite Registry Tests", function () {
    let contract;
    let authContract;
    let mintableContract;
    let unclaimedContract;

    let owner;
    let addr1;
    let addr2;
    let receiver;
    let signer;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, receiver, signer, ...addrs] = await ethers.getSigners();

        let authorizationContractFactory = await ethers.getContractFactory("SelfkeyIdAuthorization");
        authContract = await authorizationContractFactory.deploy(signer.address);

        let mintableContractFactory = await ethers.getContractFactory("SelfkeyMintableRegistry");
        mintableContract = await upgrades.deployProxy(mintableContractFactory, []);
        await mintableContract.deployed();

        let unclaimedContractFactory = await ethers.getContractFactory("SelfkeyUnclaimedRegistry");
        unclaimedContract = await upgrades.deployProxy(unclaimedContractFactory, []);
        await unclaimedContract.deployed();

        let invitationContractFactory = await ethers.getContractFactory("SelfkeyInviteCodeRegistry");
        contract = await upgrades.deployProxy(invitationContractFactory, []);
        await contract.deployed();

        await expect(contract.connect(owner).changeAuthorizedSigner(signer.address, { from: owner.address }))
            .to.emit(contract, 'AuthorizedSignerChanged').withArgs(signer.address);

        await contract.connect(owner).setAuthorizationContractAddress(authContract.address, { from: owner.address });

        await contract.connect(owner).setMintableRegistryContractAddress(mintableContract.address, { from: owner.address });

        await contract.connect(owner).setUnclaimedRegistryContractAddress(unclaimedContract.address, { from: owner.address });

        await mintableContract.connect(owner).addAuthorizedCaller(contract.address, { from: owner.address });

        await unclaimedContract.connect(owner).addAuthorizedCaller(contract.address, { from: owner.address });

    });

    describe("Deployment", function() {
        it("Deployed correctly and authorized signer was assigned", async function() {
            expect(await contract.authorizedSigner()).to.equal(signer.address);
        });
    });

    describe("Upgradeability", function() {
        it("Should upgrade correctly", async function() {
            [owner, addr1, addr2, receiver, signer, ...addrs] = await ethers.getSigners();

            let factory = await ethers.getContractFactory("SelfkeyInviteCodeRegistryV1");
            contract = await upgrades.deployProxy(factory, []);
            await contract.deployed();

            let factory2 = await ethers.getContractFactory("SelfkeyInviteCodeRegistry");
            const upgradedContract = await upgrades.upgradeProxy(contract.address, factory2);

            await expect(upgradedContract.connect(owner).setMintableRegistryContractAddress(signer.address, { from: owner.address }))
                .to.emit(upgradedContract, 'MintableRegistryContractAddressChanged').withArgs(signer.address);
        });
    });

    describe("Governance", function() {
    });

    describe("Register with award set", function() {
        it("Controller wallet can register an invite code and write to registries", async function() {
            let code = 'Code123';
            let code2 = 'Code1234';
            let amount = 100;

            expect(await contract.isInviteCodeValid(code)).to.equal(false);
            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            await expect(contract.connect(signer).registerInviteCode(addr2.address, code2, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr2.address, code2);

            await expect(contract.connect(signer).registerInviteCodeUsedWithAward(addr2.address, code, amount, 'Invite Reward', 1, signer.address, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeUsed').withArgs(addr2.address, addr1.address, code);

            expect(await contract.isInviteUsed(addr2.address)).to.equal(true);

            // Check if amount was added to the mintable registry
            expect(await mintableContract.balanceOf(addr2.address)).to.equal(amount);
            expect(await mintableContract.balanceOf(addr1.address)).to.equal(0);

            // check if amount was added to the unclaimed registry
            expect(await unclaimedContract.balanceOf(addr2.address)).to.equal(0);
            expect(await unclaimedContract.balanceOf(addr1.address)).to.equal(amount);

        });
    });

    describe("Self Register with award set", function() {
        it("Authorized user can self-register an invite code and write to registries", async function() {
            let code = 'Code123';
            let code2 = 'Code1234';
            let amount = 100;

            expect(await contract.isInviteCodeValid(code)).to.equal(false);
            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            await expect(contract.connect(signer).registerInviteCode(addr2.address, code2, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr2.address, code2);


            const _from = contract.address;
            const _to = addr2.address;
            const _amount = amount;
            const _scope = 'selfkey.invite.reward';
            const _signer = signer.address;
            const _timestamp = await time.latest();
            const _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(contract.connect(addr2).selfRegisterInviteCodeUsed(_to, code, _amount, _param, _timestamp, signer.address, signature, { from: addr2.address }))
                .to.emit(contract, 'InvitationCodeUsed').withArgs(addr2.address, addr1.address, code);

            expect(await contract.isInviteUsed(addr2.address)).to.equal(true);

            // Check if amount was added to the mintable registry
            expect(await mintableContract.balanceOf(addr2.address)).to.equal(amount);
            expect(await mintableContract.balanceOf(addr1.address)).to.equal(0);

            // check if amount was added to the unclaimed registry
            expect(await unclaimedContract.balanceOf(addr2.address)).to.equal(0);
            expect(await unclaimedContract.balanceOf(addr1.address)).to.equal(amount);

        });

        it("Non-authorized user cannot self register", async function() {
            let code = 'Code123';
            let code2 = 'Code1234';
            let amount = 100;

            expect(await contract.isInviteCodeValid(code)).to.equal(false);
            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            await expect(contract.connect(signer).registerInviteCode(addr2.address, code2, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr2.address, code2);


            const _from = contract.address;
            const _to = addr2.address;
            const _amount = amount;
            const _scope = 'selfkey.invite.rewards';
            const _signer = signer.address;
            const _timestamp = await time.latest();
            const _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(contract.connect(addr2).selfRegisterInviteCodeUsed(_to, code, _amount, _param, _timestamp, signer.address, signature, { from: addr2.address }))
                .to.be.revertedWith('Verification failed');
        });
    });

    describe("Registering invite code", function() {
        it("Controller wallet can register an invite code", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);
        });

        it("Cannot register a new invite code more than once", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.be.revertedWith('Already registered');

        });

        it("Unauthorized wallets cannot register", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(owner).registerInviteCode(addr1.address, code, { from: owner.address }))
                .to.be.revertedWith('Invalid signer');

        });

        it("Get valid invitation code owner", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);
            expect(await contract.getInviteCodeOwner(code)).to.equal(addr1.address);
        });

        it("Invalid invitation code owner", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);
            expect(await contract.getInviteCodeOwner('Code123')).to.equal(addr1.address);
        });
    });

    describe("Registering invite code usage", function() {
        it("A non-existent user cannot register a reward", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);
            expect(await contract.isInviteUsed(addr2.address)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCodeUsed(addr2.address, code, { from: signer.address }))
                .to.be.revertedWith('Address not found');

            expect(await contract.isInviteUsed(addr2.address)).to.equal(false);
        });

        it("Controller wallet can register a valid code usage", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            await expect(contract.connect(signer).registerInviteCode(addr2.address, 'Code2', { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr2.address, 'Code2');

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);
            expect(await contract.isInviteUsed(addr2.address)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCodeUsed(addr2.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeUsed').withArgs(addr2.address, addr1.address, code);

            expect(await contract.isInviteUsed(addr2.address)).to.equal(true);
        });

        it("Invitee cannot redeem more than once", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            await expect(contract.connect(signer).registerInviteCode(addr2.address, 'Code2', { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr2.address, 'Code2');

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);

            await expect(contract.connect(signer).registerInviteCodeUsed(addr2.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeUsed').withArgs(addr2.address, addr1.address, code);

            await expect(contract.connect(signer).registerInviteCodeUsed(addr2.address, code, { from: signer.address }))
                .to.be.revertedWith('Already redeemed invite code');
        });

        it("Invitee cannot redeem a non-existent code", async function() {
            let code = 'Code123';

            expect(await contract.isInviteCodeValid(code)).to.equal(false);

            await expect(contract.connect(signer).registerInviteCode(addr1.address, code, { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr1.address, code);

            await expect(contract.connect(signer).registerInviteCode(addr2.address, 'Code2', { from: signer.address }))
                .to.emit(contract, 'InvitationCodeAdded').withArgs(addr2.address, 'Code2');

            expect(await contract.getInviteCode(addr1.address)).to.equal(code);
            expect(await contract.isInviteCodeValid(code)).to.equal(true);

            await expect(contract.connect(signer).registerInviteCodeUsed(addr2.address, 'None', { from: signer.address }))
                .to.be.revertedWith('Invalid code');

        });
    });
});
