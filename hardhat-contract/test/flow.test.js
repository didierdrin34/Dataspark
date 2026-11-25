// End-to-end happy path: deliveries -> escrow split -> playbook settlement.  Run: npx hardhat test
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const key = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("DataSpark flow", () => {
  it("splits escrow by kg share and rewards a playbook that beats the baseline", async () => {
    const [admin, chair1, chair2, officer, buyer, author] = await ethers.getSigners();
    const rwf = await (await ethers.getContractFactory("MockRWF")).deploy();
    const hvst = await (await ethers.getContractFactory("HVST")).deploy(admin.address, admin.address);
    const reg = await (await ethers.getContractFactory("CooperativeRegistry")).deploy(admin.address);
    const ledger = await (await ethers.getContractFactory("HarvestLedger")).deploy(reg, rwf, hvst, admin.address);
    const pb = await (await ethers.getContractFactory("PlaybookRegistry")).deploy(hvst, hvst, ledger, reg, admin.address, admin.address);
    await hvst.grantRole(await hvst.MINTER_ROLE(), await ledger.getAddress());
    await hvst.grantRole(await hvst.MINTER_ROLE(), await pb.getAddress());

    // two cooperatives in Nyagatare
    for (const c of [chair1, chair2]) {
      await reg.connect(c).registerCooperative("Coop " + c.address.slice(2, 6), "Nyagatare");
      await reg.verifyCooperative(await reg.coopIdOfChair(c.address), true);
    }
    await reg.connect(chair1).setOfficer(1, officer.address, true);
    await reg.connect(chair2).setOfficer(2, officer.address, true);
    await reg.connect(chair1).setMember(1, key("F1"), 100);
    await reg.connect(chair1).setMember(1, key("F2"), 100);
    await reg.connect(chair2).setMember(2, key("F3"), 100);

    // playbook: stake 100 HVST, both coops follow with 1 ha each
    await hvst.transfer(author.address, ethers.parseEther("100"));
    await hvst.connect(author).approve(await pb.getAddress(), ethers.parseEther("100"));
    const now = await time.latest();
    await pb.connect(author).publish({
      district: "Nyagatare", crop: "maize", season: 20261, uri: "ipfs://demo", dataHash: key("snapshot"),
      stake: ethers.parseEther("100"), followDeadline: now + 1000, settleAfter: now + 2000,
    });
    await pb.connect(chair1).follow(1, 100);
    await pb.connect(chair2).follow(1, 100);
    await pb.setBaseline(key("Nyagatare"), key("maize"), 20261, 2000);

    // coop 1: F1 600kg + F2 400kg (batch 1). coop 2: F3 2,800 kg (batch 2). total 3,800 kg over 2 ha = 1,900 -> below baseline? use 4,600
    await ledger.connect(officer).createBatch(1, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1, key("F1"), 600, 1);
    await ledger.connect(officer).recordDelivery(1, key("F2"), 400, 1);
    await ledger.connect(chair1).confirmDelivery(1);
    await ledger.connect(chair1).confirmDelivery(2);
    await ledger.connect(officer).sealBatch(1);

    await ledger.connect(officer).createBatch(2, "maize", 20261);
    await ledger.connect(officer).recordDelivery(2, key("F3"), 3600, 1);
    await ledger.connect(chair2).confirmDelivery(3);

    // same wallet cannot be both signers
    await ledger.connect(chair1).createBatch(1, "maize", 20261);
    await ledger.connect(chair1).recordDelivery(3, key("F1"), 10, 1);
    await expect(ledger.connect(chair1).confirmDelivery(4)).to.be.revertedWith("needs second signer");

    // escrow: buyer pays 1,000,000 mRWF -> F1 gets 60%, F2 gets 40%
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000);
    await ledger.connect(buyer).fundBatch(1, 1_000_000);
    await ledger.connect(buyer).releaseBatch(1);
    expect(await ledger.batchMemberPayout(1, key("F1"))).to.equal(600_000);
    expect(await ledger.batchMemberPayout(1, key("F2"))).to.equal(400_000);
    expect(await rwf.balanceOf(chair1.address)).to.equal(1_000_000);
    expect(await hvst.balanceOf(chair1.address)).to.equal(ethers.parseEther("100")); // 1000kg * 0.1

    // settle playbook: 4,600 kg / 2 ha = 2,300 kg/ha vs 2,000 baseline = +15% -> reward 15 HVST
    await time.increase(2500);
    await pb.settle(1);
    const p = await pb.getPlaybook(1);
    expect(p.resultBps).to.equal(1500n);
    expect(await hvst.balanceOf(author.address)).to.equal(ethers.parseEther("115"));
  });
});
