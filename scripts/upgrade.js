const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const proxyAddress = "0x4D29D29AAb8030174e876cfbB32455cDAfef6e66";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyInviteCodeRegistry");
    const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory, { timeout: 500000 });
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);


    // INFO: verify contract after deployment
    // npx hardhat verify --network mumbai 0x4D29D29AAb8030174e876cfbB32455cDAfef6e66
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
