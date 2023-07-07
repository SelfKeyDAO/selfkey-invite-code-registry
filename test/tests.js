const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("SelfKey Invite Registry Tests", function () {

    let contract;

    let owner;
    let addr1;
    let addr2;
    let receiver;
    let signer;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, receiver, signer, ...addrs] = await ethers.getSigners();

        let invitationContractFactory = await ethers.getContractFactory("SelfkeyInviteCodeRegistry");
        contract = await upgrades.deployProxy(invitationContractFactory, []);
        await contract.deployed();

        await expect(contract.connect(owner).changeAuthorizedSigner(signer.address, { from: owner.address }))
                .to.emit(contract, 'AuthorizedSignerChanged').withArgs(signer.address);
    });

    describe("Deployment", function() {
        it("Deployed correctly and authorized signer was assigned", async function() {
            expect(await contract.authorizedSigner()).to.equal(signer.address);
        });
    });

    describe("Governance", function() {
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
