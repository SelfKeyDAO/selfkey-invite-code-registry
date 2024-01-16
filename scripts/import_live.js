const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Polygon address
    const proxyAddress = "0x85ef414575E256dfAA768f86f592465E47d24095";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyInviteCodeRegistryV1");
    console.log('Implementation address: ' + await upgrades.erc1967.getImplementationAddress(proxyAddress));
    console.log('Admin address: ' + await upgrades.erc1967.getAdminAddress(proxyAddress));

    const contract = await upgrades.forceImport(proxyAddress, contractFactory, { kind: 'transparent' });

    console.log("Done", contract);

    // INFO: verify contract after deployment
    // npx hardhat verify --network polygon 0x85ef414575E256dfAA768f86f592465E47d24095
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
