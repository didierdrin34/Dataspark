// Verifies every contract from deployments.<network>.json on Etherscan (needs ETHERSCAN_API_KEY).
const hre = require("hardhat");
const path = require("path");

async function v(address, args = []) {
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
  } catch (e) {
    console.log(`  ${address}: ${e.message.split("\n")[0]}`);
  }
}

async function main() {
  const d = require(path.join(__dirname, "..", `deployments.${hre.network.name}.json`));
  const c = d.contracts;
  const me = d.deployer;
  await v(c.MockRWF);
  await v(c.HVST, [me, me]);
  await v(c.CooperativeRegistry, [me]);
  await v(c.HarvestLedger, [c.CooperativeRegistry, c.MockRWF, c.HVST, me]);
  await v(c.PlaybookRegistry, [c.HVST, c.HVST, c.HarvestLedger, c.CooperativeRegistry, me, me]);
  await v(c.InputVoucher, [c.CooperativeRegistry, c.MockRWF, me]);
  await v(c.HVSTFaucet, [c.HVST]);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
