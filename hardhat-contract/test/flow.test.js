require("@nomicfoundation/hardhat-chai-matchers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const key = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
const DAY = 86400;

async function deploy() {
  const [admin, chair1, chair2, officer, buyer, author, dealer, auditor] = await ethers.getSigners();
  const rwf     = await (await ethers.getContractFactory("MockRWF")).deploy();
  const hvst    = await (await ethers.getContractFactory("HVST")).deploy(admin.address, admin.address);
  const reg     = await (await ethers.getContractFactory("CooperativeRegistry")).deploy(admin.address);
  const ledger  = await (await ethers.getContractFactory("HarvestLedger")).deploy(reg, rwf, hvst, admin.address);
  const pb      = await (await ethers.getContractFactory("PlaybookRegistry")).deploy(hvst, hvst, ledger, reg, admin.address, admin.address);
  const voucher = await (await ethers.getContractFactory("InputVoucher")).deploy(reg, rwf, admin.address);
  await hvst.grantRole(await hvst.MINTER_ROLE(), await ledger.getAddress());
  await hvst.grantRole(await hvst.MINTER_ROLE(), await pb.getAddress());
  await ledger.grantRole(await ledger.AUDITOR_ROLE(), auditor.address);
  return { rwf, hvst, reg, ledger, pb, voucher, admin, chair1, chair2, officer, buyer, author, dealer, auditor };
}

// helper: mint RWF to a signer without hitting the 24h cooldown
async function mintRWF(rwf, signer, amount) {
  // use admin transfer from a fresh faucet call on a unique wallet each time
  // simplest: impersonate a fresh address
  const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  await signer.sendTransaction({ to: wallet.address, value: ethers.parseEther("0.01") });
  await time.increase(DAY + 1);
  await rwf.connect(signer).faucet();
}

// ── CooperativeRegistry ───────────────────────────────────────────────────────
describe("CooperativeRegistry", () => {
  it("registers a cooperative and sets chair", async () => {
    const { reg, chair1 } = await deploy();
    await reg.connect(chair1).registerCooperative("Twigire", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    const coop = await reg.getCooperative(id);
    expect(coop.name).to.equal("Twigire");
    expect(coop.chair).to.equal(chair1.address);
    expect(coop.verified).to.equal(false);
    expect(coop.active).to.equal(true);
  });

  it("prevents duplicate registration from same wallet", async () => {
    const { reg, chair1 } = await deploy();
    await reg.connect(chair1).registerCooperative("A", "Nyagatare");
    await expect(reg.connect(chair1).registerCooperative("B", "Kigali"))
      .to.be.revertedWith("wallet already registered");
  });

  it("admin can verify and unverify", async () => {
    const { reg, admin, chair1 } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await reg.connect(admin).verifyCooperative(id, true);
    expect((await reg.getCooperative(id)).verified).to.equal(true);
    await reg.connect(admin).verifyCooperative(id, false);
    expect((await reg.getCooperative(id)).verified).to.equal(false);
  });

  it("non-admin cannot verify", async () => {
    const { reg, chair1, chair2 } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await expect(reg.connect(chair2).verifyCooperative(id, true)).to.be.reverted;
  });

  it("chair can add and remove officers", async () => {
    const { reg, admin, chair1, officer } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await reg.connect(admin).verifyCooperative(id, true);
    await reg.connect(chair1).setOfficer(id, officer.address, true);
    expect(await reg.isOfficer(id, officer.address)).to.equal(true);
    await reg.connect(chair1).setOfficer(id, officer.address, false);
    expect(await reg.isOfficer(id, officer.address)).to.equal(false);
  });

  it("non-chair cannot add officers", async () => {
    const { reg, chair1, buyer } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await expect(reg.connect(buyer).setOfficer(id, buyer.address, true))
      .to.be.revertedWith("not chair");
  });

  it("staff can add members after verification", async () => {
    const { reg, admin, chair1, officer } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await reg.connect(admin).verifyCooperative(id, true);
    await reg.connect(chair1).setOfficer(id, officer.address, true);
    await reg.connect(officer).setMember(id, key("F1"), 100);
    expect(await reg.memberCount(id)).to.equal(1n);
    expect(await reg.memberPlotAres(id, key("F1"))).to.equal(100n);
  });

  it("cannot add members before verification", async () => {
    const { reg, chair1 } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await expect(reg.connect(chair1).setMember(id, key("F1"), 100))
      .to.be.revertedWith("coop not verified");
  });

  it("setMember with plotAres=0 removes the member", async () => {
    const { reg, admin, chair1 } = await deploy();
    await reg.connect(chair1).registerCooperative("T", "Nyagatare");
    const id = await reg.coopIdOfChair(chair1.address);
    await reg.connect(admin).verifyCooperative(id, true);
    await reg.connect(chair1).setMember(id, key("F1"), 100);
    expect(await reg.memberCount(id)).to.equal(1n);
    await reg.connect(chair1).setMember(id, key("F1"), 0);
    expect(await reg.memberCount(id)).to.equal(0n);
  });
});

// ── HarvestLedger ─────────────────────────────────────────────────────────────
describe("HarvestLedger", () => {
  async function setupCoop() {
    const ctx = await deploy();
    const { reg, admin, chair1, officer } = ctx;
    await reg.connect(chair1).registerCooperative("Twigire", "Nyagatare");
    const coopId = await reg.coopIdOfChair(chair1.address);
    await reg.connect(admin).verifyCooperative(coopId, true);
    await reg.connect(chair1).setOfficer(coopId, officer.address, true);
    await reg.connect(chair1).setMember(coopId, key("F1"), 100);
    await reg.connect(chair1).setMember(coopId, key("F2"), 100);
    return { ...ctx, coopId };
  }

  it("creates a batch", async () => {
    const { ledger, officer, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    expect(await ledger.batchCount()).to.equal(1n);
    const b = await ledger.getBatch(1n);
    expect(b.crop).to.equal("maize");
    expect(b.status).to.equal(0n);
  });

  it("records and confirms a delivery (two-signer)", async () => {
    const { ledger, officer, chair1, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 500, 1);
    expect((await ledger.getDelivery(1n)).kg).to.equal(500n);
    expect((await ledger.getDelivery(1n)).confirmed).to.equal(false);
    await ledger.connect(chair1).confirmDelivery(1n);
    expect((await ledger.getDelivery(1n)).confirmed).to.equal(true);
    expect((await ledger.getBatch(1n)).totalKg).to.equal(500n);
  });

  it("enforces two-signer: recorder cannot confirm own delivery", async () => {
    const { ledger, chair1, coopId } = await setupCoop();
    await ledger.connect(chair1).createBatch(coopId, "maize", 20261);
    await ledger.connect(chair1).recordDelivery(1n, key("F1"), 100, 1);
    await expect(ledger.connect(chair1).confirmDelivery(1n))
      .to.be.revertedWith("needs second signer");
  });

  it("seals only when all deliveries confirmed", async () => {
    const { ledger, officer, chair1, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 300, 1);
    await expect(ledger.connect(officer).sealBatch(1n))
      .to.be.revertedWith("unconfirmed deliveries");
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(officer).sealBatch(1n);
    expect((await ledger.getBatch(1n)).status).to.equal(1n);
  });

  it("buyer funds escrow and releases with correct kg split", async () => {
    const { ledger, rwf, officer, chair1, buyer, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 600, 1);
    await ledger.connect(officer).recordDelivery(1n, key("F2"), 400, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(chair1).confirmDelivery(2n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000n);
    await ledger.connect(buyer).fundBatch(1n, 1_000_000n);
    expect((await ledger.getBatch(1n)).status).to.equal(2n);
    await ledger.connect(buyer).releaseBatch(1n);
    expect((await ledger.getBatch(1n)).status).to.equal(3n);
    expect(await ledger.batchMemberPayout(1n, key("F1"))).to.equal(600_000n);
    expect(await ledger.batchMemberPayout(1n, key("F2"))).to.equal(400_000n);
    expect(await rwf.balanceOf(chair1.address)).to.equal(1_000_000n);
  });

  it("mints HVST rewards on release", async () => {
    const { ledger, rwf, hvst, officer, chair1, buyer, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 1000, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000n);
    await ledger.connect(buyer).fundBatch(1n, 1_000_000n);
    await ledger.connect(buyer).releaseBatch(1n);
    // 1000 kg * 0.1 HVST/kg = 100 HVST
    expect(await hvst.balanceOf(chair1.address)).to.equal(ethers.parseEther("100"));
  });

  it("chair can release after 14-day timeout if buyer is silent", async () => {
    const { ledger, rwf, officer, chair1, buyer, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 500, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 500_000n);
    await ledger.connect(buyer).fundBatch(1n, 500_000n);
    await expect(ledger.connect(chair1).releaseBatch(1n))
      .to.be.revertedWith("not allowed yet");
    await time.increase(14 * DAY + 1);
    await ledger.connect(chair1).releaseBatch(1n);
    expect((await ledger.getBatch(1n)).status).to.equal(3n);
  });

  it("auditor flags a delivery and reduces totalKg", async () => {
    const { ledger, officer, chair1, auditor, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 500, 1);
    await ledger.connect(officer).recordDelivery(1n, key("F2"), 300, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(chair1).confirmDelivery(2n);
    await ledger.connect(auditor).flagDelivery(1n);
    expect((await ledger.getDelivery(1n)).flagged).to.equal(true);
    expect((await ledger.getBatch(1n)).totalKg).to.equal(300n);
  });

  it("non-auditor cannot flag", async () => {
    const { ledger, officer, chair1, buyer, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 500, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await expect(ledger.connect(buyer).flagDelivery(1n)).to.be.reverted;
  });

  it("coopScore tracks confirms, flags, and releases", async () => {
    const { ledger, rwf, officer, chair1, buyer, auditor, coopId } = await setupCoop();
    await ledger.connect(officer).createBatch(coopId, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 500, 1);
    await ledger.connect(officer).recordDelivery(1n, key("F2"), 300, 1);
    await ledger.connect(chair1).confirmDelivery(1n); // +1
    await ledger.connect(chair1).confirmDelivery(2n); // +1
    expect(await ledger.coopScore(coopId)).to.equal(2n);
    await ledger.connect(auditor).flagDelivery(2n);   // -10
    expect(await ledger.coopScore(coopId)).to.equal(-8n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 500_000n);
    await ledger.connect(buyer).fundBatch(1n, 500_000n);
    await ledger.connect(buyer).releaseBatch(1n);     // +5
    expect(await ledger.coopScore(coopId)).to.equal(-3n);
  });
});

// ── PlaybookRegistry ──────────────────────────────────────────────────────────
describe("PlaybookRegistry", () => {
  async function setupWithPlaybook() {
    const ctx = await deploy();
    const { reg, admin, chair1, chair2, officer, pb, hvst, author } = ctx;
    for (const [c, n] of [[chair1, "C1"], [chair2, "C2"]]) {
      await reg.connect(c).registerCooperative(n, "Nyagatare");
      const id = await reg.coopIdOfChair(c.address);
      await reg.connect(admin).verifyCooperative(id, true);
      await reg.connect(c).setOfficer(id, officer.address, true);
    }
    const id1 = await reg.coopIdOfChair(chair1.address);
    const id2 = await reg.coopIdOfChair(chair2.address);
    await reg.connect(chair1).setMember(id1, key("F1"), 100);
    await reg.connect(chair2).setMember(id2, key("F2"), 100);
    await hvst.transfer(author.address, ethers.parseEther("200"));
    await hvst.connect(author).approve(await pb.getAddress(), ethers.parseEther("200"));
    const now = await time.latest();
    await pb.connect(author).publish({
      district: "Nyagatare", crop: "maize", season: 20261,
      uri: "ipfs://demo", dataHash: key("snap"),
      stake: ethers.parseEther("100"),
      followDeadline: now + 1000,
      settleAfter: now + 2000,
    });
    await pb.setBaseline(key("Nyagatare"), key("maize"), 20261, 2000);
    return { ...ctx, id1, id2 };
  }

  it("publishes a playbook and locks stake", async () => {
    const { pb, hvst, author } = await setupWithPlaybook();
    const p = await pb.getPlaybook(1n);
    expect(p.author).to.equal(author.address);
    expect(p.stake).to.equal(ethers.parseEther("100"));
    expect(await hvst.balanceOf(await pb.getAddress())).to.equal(ethers.parseEther("100"));
  });

  it("cooperative chair can follow in matching district", async () => {
    const { pb, chair1 } = await setupWithPlaybook();
    await pb.connect(chair1).follow(1n, 100);
    const p = await pb.getPlaybook(1n);
    expect(p.followerCount).to.equal(1n);
    expect(p.totalAres).to.equal(100n);
  });

  it("cannot follow after follow deadline", async () => {
    const { pb, chair1 } = await setupWithPlaybook();
    await time.increase(1001);
    await expect(pb.connect(chair1).follow(1n, 100))
      .to.be.revertedWith("follow window closed");
  });

  it("cannot follow same playbook twice", async () => {
    const { pb, chair1 } = await setupWithPlaybook();
    await pb.connect(chair1).follow(1n, 100);
    await expect(pb.connect(chair1).follow(1n, 100))
      .to.be.revertedWith("already following");
  });

  it("cannot settle before settleAfter", async () => {
    const { pb } = await setupWithPlaybook();
    await expect(pb.settle(1n)).to.be.revertedWith("too early");
  });

  it("settles Inconclusive when fewer than minFollowers", async () => {
    const { pb } = await setupWithPlaybook();
    await time.increase(2500);
    await pb.settle(1n);
    expect((await pb.getPlaybook(1n)).status).to.equal(4n);
  });

  it("settles Neutral when yield misses baseline by <=10%", async () => {
    const { pb, ledger, rwf, officer, chair1, buyer, id1 } = await setupWithPlaybook();
    await pb.connect(chair1).follow(1n, 100);
    // lower minFollowers to 1 so we can settle with one coop
    await pb.setParams(ethers.parseEther("100"), 1, await pb.insurancePool());
    await ledger.connect(officer).createBatch(id1, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 1900, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000n);
    await ledger.connect(buyer).fundBatch(1n, 1_000_000n);
    await ledger.connect(buyer).releaseBatch(1n);
    await time.increase(2500);
    await pb.settle(1n);
    // 1900/1ha vs 2000 = -5%, within 10% threshold -> Neutral
    expect((await pb.getPlaybook(1n)).status).to.equal(2n);
  });

  it("settles Rewarded when yield beats baseline", async () => {
    const { pb, ledger, rwf, officer, chair1, chair2, buyer, author, hvst, id1, id2 } = await setupWithPlaybook();
    await pb.connect(chair1).follow(1n, 100);
    await pb.connect(chair2).follow(1n, 100);
    // coop1: 2400kg, coop2: 2000kg => 4400/2ha = 2200 vs 2000 = +10%
    await ledger.connect(officer).createBatch(id1, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 2400, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000n);
    await ledger.connect(buyer).fundBatch(1n, 1_000_000n);
    await ledger.connect(buyer).releaseBatch(1n);

    await time.increase(DAY + 1);
    await ledger.connect(officer).createBatch(id2, "maize", 20261);
    await ledger.connect(officer).recordDelivery(2n, key("F2"), 2000, 1);
    await ledger.connect(chair2).confirmDelivery(2n);
    await ledger.connect(officer).sealBatch(2n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000n);
    await ledger.connect(buyer).fundBatch(2n, 1_000_000n);
    await ledger.connect(buyer).releaseBatch(2n);

    await time.increase(2500);
    await pb.settle(1n);
    const p = await pb.getPlaybook(1n);
    expect(p.status).to.equal(1n); // Rewarded
    expect(p.resultBps).to.equal(1000n); // +10%
    // author started with 200, staked 100, gets back 100 + 10% bonus (10 HVST minted) = 110 in wallet
    // but author also had 100 remaining from the transfer, so total = 100 (never staked) + 110 = 210
    expect(await hvst.balanceOf(author.address)).to.equal(ethers.parseEther("210"));
  });

  it("slashes stake when yield misses baseline by >10%", async () => {
    const { pb, ledger, rwf, officer, chair1, chair2, buyer, author, hvst, id1, id2 } = await setupWithPlaybook();
    await pb.connect(chair1).follow(1n, 100);
    await pb.connect(chair2).follow(1n, 100);
    // 750+750 / 2ha = 750 kg/ha vs 2000 = -62.5% -> slash capped at 50%
    await ledger.connect(officer).createBatch(id1, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 750, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 500_000n);
    await ledger.connect(buyer).fundBatch(1n, 500_000n);
    await ledger.connect(buyer).releaseBatch(1n);

    await time.increase(DAY + 1);
    await ledger.connect(officer).createBatch(id2, "maize", 20261);
    await ledger.connect(officer).recordDelivery(2n, key("F2"), 750, 1);
    await ledger.connect(chair2).confirmDelivery(2n);
    await ledger.connect(officer).sealBatch(2n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 500_000n);
    await ledger.connect(buyer).fundBatch(2n, 500_000n);
    await ledger.connect(buyer).releaseBatch(2n);

    await time.increase(2500);
    await pb.settle(1n);
    expect((await pb.getPlaybook(1n)).status).to.equal(3n); // Slashed
    // author had 200 HVST, staked 100, gets back 50 (50% slashed) = 150 total
    expect(await hvst.balanceOf(author.address)).to.equal(ethers.parseEther("150"));
  });
});

// ── InputVoucher ──────────────────────────────────────────────────────────────
describe("InputVoucher", () => {
  async function setupVoucher() {
    const ctx = await deploy();
    const { reg, admin, chair1, voucher, dealer } = ctx;
    await reg.connect(chair1).registerCooperative("Twigire", "Nyagatare");
    const coopId = await reg.coopIdOfChair(chair1.address);
    await reg.connect(admin).verifyCooperative(coopId, true);
    await reg.connect(chair1).setMember(coopId, key("F1"), 100);
    await voucher.setDealer(dealer.address, "AgroDealer", true);
    return { ...ctx, coopId };
  }

  it("issues a batch of vouchers", async () => {
    const { voucher, admin, coopId } = await setupVoucher();
    const now = await time.latest();
    await voucher.connect(admin).issueBatch(coopId, [key("F1")], [1000], key("seed"), now + 10, now + DAY);
    const vs = await voucher.vouchersOf(coopId, key("F1"));
    expect(vs.length).to.equal(1);
    expect(vs[0].amount).to.equal(1000n);
  });

  it("dealer redeems within window", async () => {
    const { voucher, rwf, admin, dealer, coopId } = await setupVoucher();
    const now = await time.latest();
    await voucher.connect(admin).issueBatch(coopId, [key("F1")], [1000], key("seed"), now, now + DAY);
    await rwf.connect(admin).faucet();
    await rwf.connect(admin).approve(await voucher.getAddress(), 1000n);
    await voucher.connect(admin).fundReserve(1000n);
    await voucher.connect(dealer).redeem(coopId, key("F1"), 0, 500, key("BAG"));
    expect((await voucher.vouchersOf(coopId, key("F1")))[0].amount).to.equal(500n);
  });

  it("cannot redeem before notBefore", async () => {
    const { voucher, admin, dealer, coopId } = await setupVoucher();
    const now = await time.latest();
    await voucher.connect(admin).issueBatch(coopId, [key("F1")], [1000], key("seed"), now + 9999, now + 99999);
    await expect(voucher.connect(dealer).redeem(coopId, key("F1"), 0, 500, key("X")))
      .to.be.revertedWith("not yet usable");
  });

  it("cannot redeem after expiry", async () => {
    const { voucher, admin, dealer, coopId } = await setupVoucher();
    const now = await time.latest();
    await voucher.connect(admin).issueBatch(coopId, [key("F1")], [1000], key("seed"), now, now + 100);
    await time.increase(200);
    await expect(voucher.connect(dealer).redeem(coopId, key("F1"), 0, 500, key("X")))
      .to.be.revertedWith("expired");
  });

  it("oracle declares trigger and issues emergency vouchers", async () => {
    const { voucher, admin, reg, coopId } = await setupVoucher();
    const distKey = (await reg.getCooperative(coopId)).districtKey;
    const reason = key("drought");
    await voucher.connect(admin).declareTrigger(distKey, reason, 2, key("evidence"));
    const now = await time.latest();
    await voucher.connect(admin).issueEmergency(coopId, [key("F1")], [2000], reason, now + DAY);
    const vs = await voucher.vouchersOf(coopId, key("F1"));
    expect(vs[0].emergency).to.equal(true);
    expect(vs[0].amount).to.equal(2000n);
  });

  it("emergency voucher fails without active trigger", async () => {
    const { voucher, admin, coopId } = await setupVoucher();
    const now = await time.latest();
    await expect(
      voucher.connect(admin).issueEmergency(coopId, [key("F1")], [1000], key("drought"), now + DAY)
    ).to.be.revertedWith("no active trigger");
  });
});

// ── HVST ──────────────────────────────────────────────────────────────────────
describe("HVST", () => {
  it("only minter role can mint", async () => {
    const { hvst, admin, chair1 } = await deploy();
    await expect(hvst.connect(chair1).mint(chair1.address, 100n)).to.be.reverted;
    await hvst.grantRole(await hvst.MINTER_ROLE(), admin.address);
    await hvst.connect(admin).mint(chair1.address, ethers.parseEther("1"));
    expect(await hvst.balanceOf(chair1.address)).to.equal(ethers.parseEther("1"));
  });

  it("cannot exceed MAX_SUPPLY", async () => {
    const { hvst, admin } = await deploy();
    await hvst.grantRole(await hvst.MINTER_ROLE(), admin.address);
    const remaining = (await hvst.MAX_SUPPLY()) - (await hvst.totalSupply());
    await expect(hvst.connect(admin).mint(admin.address, remaining + 1n))
      .to.be.revertedWith("max supply");
  });
});

// ── Full season end-to-end ────────────────────────────────────────────────────
describe("Full season end-to-end", () => {
  it("two coops deliver, get paid, playbook settles with +15% reward", async () => {
    const [admin, chair1, chair2, officer, buyer, author] = await ethers.getSigners();
    const rwf    = await (await ethers.getContractFactory("MockRWF")).deploy();
    const hvst   = await (await ethers.getContractFactory("HVST")).deploy(admin.address, admin.address);
    const reg    = await (await ethers.getContractFactory("CooperativeRegistry")).deploy(admin.address);
    const ledger = await (await ethers.getContractFactory("HarvestLedger")).deploy(reg, rwf, hvst, admin.address);
    const pb     = await (await ethers.getContractFactory("PlaybookRegistry")).deploy(hvst, hvst, ledger, reg, admin.address, admin.address);
    await hvst.grantRole(await hvst.MINTER_ROLE(), await ledger.getAddress());
    await hvst.grantRole(await hvst.MINTER_ROLE(), await pb.getAddress());

    for (const c of [chair1, chair2]) {
      await reg.connect(c).registerCooperative("Coop-" + c.address.slice(2, 6), "Nyagatare");
      const id = await reg.coopIdOfChair(c.address);
      await reg.verifyCooperative(id, true);
      await reg.connect(c).setOfficer(id, officer.address, true);
    }
    const id1 = await reg.coopIdOfChair(chair1.address);
    const id2 = await reg.coopIdOfChair(chair2.address);
    await reg.connect(chair1).setMember(id1, key("F1"), 100);
    await reg.connect(chair1).setMember(id1, key("F2"), 100);
    await reg.connect(chair2).setMember(id2, key("F3"), 100);

    await hvst.transfer(author.address, ethers.parseEther("100"));
    await hvst.connect(author).approve(await pb.getAddress(), ethers.parseEther("100"));
    const now = await time.latest();
    await pb.connect(author).publish({
      district: "Nyagatare", crop: "maize", season: 20261,
      uri: "ipfs://demo", dataHash: key("snap"),
      stake: ethers.parseEther("100"),
      followDeadline: now + 1000,
      settleAfter: now + 2000,
    });
    await pb.setBaseline(key("Nyagatare"), key("maize"), 20261, 2000);
    await pb.connect(chair1).follow(1n, 100);
    await pb.connect(chair2).follow(1n, 100);

    // Coop1: F1=600kg, F2=400kg -> 1000kg total
    await ledger.connect(officer).createBatch(id1, "maize", 20261);
    await ledger.connect(officer).recordDelivery(1n, key("F1"), 600, 1);
    await ledger.connect(officer).recordDelivery(1n, key("F2"), 400, 1);
    await ledger.connect(chair1).confirmDelivery(1n);
    await ledger.connect(chair1).confirmDelivery(2n);
    await ledger.connect(officer).sealBatch(1n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 1_000_000n);
    await ledger.connect(buyer).fundBatch(1n, 1_000_000n);
    await ledger.connect(buyer).releaseBatch(1n);

    // Coop2: F3=3600kg (next day so faucet cooldown resets)
    await time.increase(DAY + 1);
    await ledger.connect(officer).createBatch(id2, "maize", 20261);
    await ledger.connect(officer).recordDelivery(2n, key("F3"), 3600, 1);
    await ledger.connect(chair2).confirmDelivery(3n);
    await ledger.connect(officer).sealBatch(2n);
    await rwf.connect(buyer).faucet();
    await rwf.connect(buyer).approve(await ledger.getAddress(), 2_000_000n);
    await ledger.connect(buyer).fundBatch(2n, 2_000_000n);
    await ledger.connect(buyer).releaseBatch(2n);

    expect(await ledger.batchMemberPayout(1n, key("F1"))).to.equal(600_000n);
    expect(await ledger.batchMemberPayout(1n, key("F2"))).to.equal(400_000n);
    expect(await rwf.balanceOf(chair1.address)).to.equal(1_000_000n);
    expect(await rwf.balanceOf(chair2.address)).to.equal(2_000_000n);

    // 4600 kg / 2 ha = 2300 kg/ha vs 2000 baseline = +15%
    await time.increase(2500);
    await pb.settle(1n);
    const p = await pb.getPlaybook(1n);
    expect(p.status).to.equal(1n);       // Rewarded
    expect(p.resultBps).to.equal(1500n); // +15%
    // 100 HVST stake returned + 15% bonus = 115 HVST
    expect(await hvst.balanceOf(author.address)).to.equal(ethers.parseEther("115"));
  });
});
