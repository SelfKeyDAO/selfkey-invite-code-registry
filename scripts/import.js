const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Mumbai address
    const proxyAddress = "0x4D29D29AAb8030174e876cfbB32455cDAfef6e66";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyInviteCodeRegistryV1");
    console.log('Implementation address: ' + await upgrades.erc1967.getImplementationAddress(proxyAddress));
    console.log('Admin address: ' + await upgrades.erc1967.getAdminAddress(proxyAddress));

    const contract = await upgrades.forceImport(proxyAddress, contractFactory, { kind: 'transparent' });

    console.log("Done", contract);

    // INFO: verify contract after deployment
    // npx hardhat verify --network mumbai 0x4D29D29AAb8030174e876cfbB32455cDAfef6e66
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
