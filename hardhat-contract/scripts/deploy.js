// Usage:  npx hardhat run scripts/deploy.js --network sepolia
// Deploys all DataSpark contracts, wires roles, optionally seeds a demo cooperative, and writes
// ../frontend/lib/deployments.json so the Next.js app picks up the new addresses automatically.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const key = (s) => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function deploy(name, ...args) {
  const factory = await hre.ethers.getContractFactory(name);
  const c = await factory.deploy(...args);
  await c.waitForDeployment();
  await sleep(5000); // avoid in-flight tx limit
  const address = await c.getAddress();
  console.log(`  ${name.padEnd(20)} ${address}`);
  return c;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network: ${hre.network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}  balance: ${hre.ethers.formatEther(balance)} ETH\n`);
  if (balance === 0n) throw new Error("Deployer has 0 ETH. Get Sepolia ETH from a faucet first.");

  const oracle = process.env.ORACLE_ADDRESS || deployer.address;
  const officer = process.env.OFFICER_ADDRESS || "";

  console.log("Deploying...");
  const rwf = await deploy("MockRWF");
  const hvst = await deploy("HVST", deployer.address, deployer.address);
  const registry = await deploy("CooperativeRegistry", deployer.address);
  const ledger = await deploy("HarvestLedger", await registry.getAddress(), await rwf.getAddress(), await hvst.getAddress(), deployer.address);
  const playbooks = await deploy(
    "PlaybookRegistry",
    await hvst.getAddress(),
    await hvst.getAddress(),
    await ledger.getAddress(),
    await registry.getAddress(),
    deployer.address, // insurance pool placeholder: replace with a real pool contract later
    deployer.address
  );
  const voucher = await deploy("InputVoucher", await registry.getAddress(), await rwf.getAddress(), deployer.address);
  const faucet = await deploy("HVSTFaucet", await hvst.getAddress());

  console.log("\nWiring roles...");
  const MINTER = await hvst.MINTER_ROLE();
  await (await hvst.grantRole(MINTER, await ledger.getAddress())).wait();
  await (await hvst.grantRole(MINTER, await playbooks.getAddress())).wait();
  if (oracle !== deployer.address) {
    await (await playbooks.grantRole(await playbooks.ORACLE_ROLE(), oracle)).wait();
    await (await voucher.grantRole(await voucher.ORACLE_ROLE(), oracle)).wait();
  }
  // fund the demo HVST faucet with 1,000,000 HVST from the treasury (deployer)
  await (await hvst.transfer(await faucet.getAddress(), hre.ethers.parseEther("1000000"))).wait();
  console.log("  roles granted, faucet funded");

  if (process.env.SEED_DEMO === "true") {
    console.log("\nSeeding demo data...");
    await (await registry.registerCooperative("Twigire Nyagatare Maize Cooperative", "Nyagatare")).wait();
    const coopId = await registry.coopIdOfChair(deployer.address);
    await (await registry.verifyCooperative(coopId, true)).wait();
    if (officer) {
      await (await registry.setOfficer(coopId, officer, true)).wait();
      console.log(`  officer set: ${officer}`);
    } else {
      await (await ledger.setTwoSignerRequired(false)).wait();
      console.log("  no OFFICER_ADDRESS: two-signer rule disabled for the single-wallet demo");
    }
    for (let i = 1; i <= 5; i++) {
      await (await registry.setMember(coopId, key(`RW-NYA-000${i}`), 80 + i * 20)).wait(); // ares
    }
    // 2026 Season A (20261) baseline for maize in Nyagatare: 2,400 kg/ha (demo number)
    await (await playbooks.setBaseline(key("Nyagatare"), key("maize"), 20261, 2400)).wait();
    console.log(`  cooperative #${coopId} (Nyagatare) with 5 members, maize baseline set`);
  }

  const out = {
    chainId: Number(net.chainId),
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      HVST: await hvst.getAddress(),
      MockRWF: await rwf.getAddress(),
      CooperativeRegistry: await registry.getAddress(),
      HarvestLedger: await ledger.getAddress(),
      PlaybookRegistry: await playbooks.getAddress(),
      InputVoucher: await voucher.getAddress(),
      HVSTFaucet: await faucet.getAddress(),
    },
  };
  const target = path.join(__dirname, "..", "..", "frontend", "lib", "deployments.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", `deployments.${hre.network.name}.json`), JSON.stringify(out, null, 2));
  console.log(`\nAddresses written to ${path.relative(process.cwd(), target)}`);
  console.log("Verify on Etherscan:  npx hardhat run scripts/verify.js --network sepolia");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
