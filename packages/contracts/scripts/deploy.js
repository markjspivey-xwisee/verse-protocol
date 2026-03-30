const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  async function deployWithRetry(name, factory, args = []) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`\n   Deploying ${name}... (attempt ${attempt + 1})`);
        const contract = await factory.deploy(...args);
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        console.log(`   ${name} deployed to: ${addr}`);
        // Wait for nonce to propagate on public RPC
        await new Promise(r => setTimeout(r, 5000));
        return { contract, address: addr };
      } catch (err) {
        console.log(`   Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < 2) {
          console.log("   Waiting 10s before retry...");
          await new Promise(r => setTimeout(r, 10000));
        } else throw err;
      }
    }
  }

  // 1. Deploy VerseToken
  console.log("\n1. VerseToken");
  const VerseToken = await hre.ethers.getContractFactory("VerseToken");
  const { contract: verseToken, address: tokenAddress } = await deployWithRetry("VerseToken", VerseToken);

  // 2. Deploy InfluenceAnchor
  console.log("\n2. InfluenceAnchor");
  const InfluenceAnchor = await hre.ethers.getContractFactory("InfluenceAnchor");
  const { contract: anchor, address: anchorAddress } = await deployWithRetry("InfluenceAnchor", InfluenceAnchor);

  // 3. Deploy Marketplace
  console.log("\n3. Marketplace");
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const { contract: marketplace, address: marketplaceAddress } = await deployWithRetry("Marketplace", Marketplace, [tokenAddress]);

  // 4. Wire contracts together
  console.log("\n4. Wiring contracts...");
  await verseToken.setInfluenceAnchor(anchorAddress);
  console.log("   VerseToken.influenceAnchor =", anchorAddress);
  await verseToken.setMarketplace(marketplaceAddress);
  console.log("   VerseToken.marketplace =", marketplaceAddress);

  // 5. Seed bonding curve with initial ETH (optional)
  console.log("\n5. Seeding bonding curve...");
  const seedTx = await deployer.sendTransaction({
    to: tokenAddress,
    value: hre.ethers.parseEther("0.01"),
  });
  await seedTx.wait();
  console.log("   Sent 0.01 ETH to bonding curve");

  // Output deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE — Base Sepolia");
  console.log("=".repeat(60));
  console.log(`VerseToken:       ${tokenAddress}`);
  console.log(`InfluenceAnchor:  ${anchorAddress}`);
  console.log(`Marketplace:      ${marketplaceAddress}`);
  console.log(`Chain ID:         ${(await hre.ethers.provider.getNetwork()).chainId}`);
  console.log("=".repeat(60));

  // Save deployment addresses
  const fs = require("fs");
  const path = require("path");
  const deployment = {
    network: "baseSepolia",
    chainId: 84532,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      VerseToken: tokenAddress,
      InfluenceAnchor: anchorAddress,
      Marketplace: marketplaceAddress,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "baseSepolia.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log(`\nSaved to deployments/baseSepolia.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
