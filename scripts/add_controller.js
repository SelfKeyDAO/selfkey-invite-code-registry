const { ethers, upgrades } = require('hardhat');

const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('CONTROLLER_ROLE'));

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Executing with the account:", deployer.address);

    // TODO: change
    const controller_address = "0x5e1AF7F8971400885DF853F13a6C8785C9918BD0";
    const proxy_address = "0xdB6F290C970d8E8437B7422853BaE6DF6ec48AB4";

    const registryContractFactory = await ethers.getContractFactory("SelfkeyIdRegistry");
    const contract = await registryContractFactory.attach(proxy_address);

    const res = await contract.grantRole(CONTROLLER_ROLE, controller_address);
    console.log(res);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
