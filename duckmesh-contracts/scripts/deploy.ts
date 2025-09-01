import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Starting complete deployment with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployedContracts: { [key: string]: string } = {};

  // 1. Deploy DuckToken (no dependencies)
  console.log("\n1. Deploying DuckToken...");
  const DuckToken = await ethers.getContractFactory("DuckToken");
  const initialSupply = 1000000; // 1 million tokens
  const duckToken = await DuckToken.deploy(initialSupply, deployer.address);
  await duckToken.waitForDeployment();
  deployedContracts.DuckToken = await duckToken.getAddress();
  console.log("✓ DuckToken deployed to:", deployedContracts.DuckToken);

  // 2. Deploy ProviderRegistry (depends on DuckToken)
  console.log("\n3. Deploying ProviderRegistry...");
  const ProviderRegistry = await ethers.getContractFactory("ProviderRegistry");
  const providerRegistry = await ProviderRegistry.deploy(deployedContracts.DuckToken, deployer.address);
  await providerRegistry.waitForDeployment();
  deployedContracts.ProviderRegistry = await providerRegistry.getAddress();
  console.log("✓ ProviderRegistry deployed to:", deployedContracts.ProviderRegistry);

  // 3. Deploy JobMarket (depends on DuckToken and ProviderRegistry)
  console.log("\n4. Deploying JobMarket...");
  const JobMarket = await ethers.getContractFactory("JobMarket");
  const jobMarket = await JobMarket.deploy(
    deployedContracts.DuckToken,
    deployedContracts.ProviderRegistry,
    deployer.address
  );
  await jobMarket.waitForDeployment();
  deployedContracts.JobMarket = await jobMarket.getAddress();
  console.log("✓ JobMarket deployed to:", deployedContracts.JobMarket);

  // 4. Deploy Payments (depends on DuckToken)
  console.log("\n10. Deploying Payments...");
  const Payments = await ethers.getContractFactory("Payments");
  const payments = await Payments.deploy(deployedContracts.DuckToken, deployer.address);
  await payments.waitForDeployment();
  deployedContracts.Payments = await payments.getAddress();
  console.log("✓ Payments deployed to:", deployedContracts.Payments);
 

  console.log("\n=== COMPLETE DEPLOYMENT SUMMARY ===");
  console.log("Network: DuckChain Testnet");
  console.log("Deployer:", deployer.address);
  console.log("\nCore Contracts:");
  console.log(`DuckToken: ${deployedContracts.DuckToken}`);
  
  console.log("\nJob Market Contracts:");
  console.log(`ProviderRegistry: ${deployedContracts.ProviderRegistry}`);
  console.log(`JobMarket: ${deployedContracts.JobMarket}`);
  console.log(`Payments: ${deployedContracts.Payments}`);
  
  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Set up frontend with these contract addresses");
  console.log("3. Test the complete flow");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});