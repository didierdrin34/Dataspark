**DataSpark + HVST** connects real-time weather and climate intelligence across Rwanda’s 30 districts with on-chain agronomic playbooks, two-signer harvest verification, buyer escrow in **mRWF**, non-transferable input vouchers, and **HVST** rewards/staking on Ethereum Sepolia.

---

### End-to-End Lifecycle

* **A — Climate Telemetry & Risk Scoring:** The frontend queries Open-Meteo across Rwanda’s 30 districts (with coordinates in `rwandaDistrict.ts` and WMO codes/advisories in `weatherCode.ts`) to compute storm, drought, and composite risk scores and display radar layers.
* **B — Drought Triggers & Input Vouchers (`InputVoucher.sol`):** When climate signals or oracle rules indicate drought stress, authorized roles can declare a drought trigger for a district/season and issue time-windowed, non-transferable input vouchers backed by settlement funds (`mRWF`), which agro-dealers redeem within the planting window.
* **C — Playbook Publishing & Staking (`PlaybookRegistry.sol`):** Agronomists or authors stake **HVST** on a district, crop, and season playbook with a yield baseline (`baselineKg`), locking stake in the contract.
* **D — Cooperative Registration & Following (`CooperativeRegistry.sol`):** Cooperatives are registered with a district hash and a chairperson wallet, and members are tracked via hashed member codes (`memberCodeHash`) for privacy; chairpersons in the matching district follow playbooks.
* **E — Two-Signer Delivery Recording (`HarvestLedger.sol`):** An authorized field officer records a member delivery (`weightKg`, crop, season, hashed member code), and the cooperative chairperson must confirm it (`confirmDelivery`) before it can be batched—unless flagged by an auditor (`flagDelivery`).
* **F — Batching & Buyer Escrow (`HarvestLedger.sol`):** Confirmed, unflagged deliveries are grouped into a batch (`createBatch`). A buyer funds escrow in **mRWF** (`fundBatchEscrow`).
* **G — Settlement, Payout & HVST Minting (`HarvestLedger.sol`):** Releasing escrow (by the buyer, or by the chairperson after the 14-day release timeout) pays out **mRWF** and mints **HVST** rewards tied to verified settled batch weight (`totalKg`), so unconfirmed or unpaid deliveries earn nothing.
* **H — End-of-Season Playbook Settlement (`PlaybookRegistry.sol`):** Observed yield against the baseline settles the playbook: beating baseline can mint up to a +50% **HVST** bonus to the author, while missing by more than 10% can slash up to 50% of the stake to the insurance pool.

---

### Participant Journey Diagram (A to Z)

```text
[Weather / Oracle] ---> (1) Publish district forecasts & drought triggers
                               |
                               v
   +-----------------------------------------------------------------------+
   |                     FRONTEND (Sepolia + Wallet)                       |
   |  30-District Radar & Risk | Playbook Market | Co-op Desk | Wallet UX  |
   +-----------------------------------------------------------------------+
       |                        |                        |            |
       | (2) Stake HVST         | (3) Follow PB &        | (4) Issue  | (6) Fund mRWF
       | + set baseline         |     add hashed         |     voucher|     escrow &
       v                        |     members            v            |     release
 [Playbook Author]              v                  [Agro-Dealer]      |
       |                 [Co-op Chairperson]             |            |
       |                        |                        | (5) Redeem |
       |                        | (5a) Record &          |     in     |
       |                        |      2-signer          |     window |
       |                        |      confirm kg        v            |
       |                        v                  [InputVoucher.sol]  |
       |                 [HarvestLedger.sol] <-----------------------+
       |                        |                        |      [Buyer]
       |                        | (7) Release escrow     |
       |                        |     -> pay mRWF        |
       |                        |     -> mint HVST       |
       |                        v                        |
       |                 [HVST Token] & [mRWF] <---------+
       |                        ^
       | (8) Settle vs baseline |
       |     -> +50% mint OR    |
       |     -> up to 50% slash |
       +------------------------+
                   |
                   v
          [Insurance Pool]  &  [Auditor] (can flag suspicious deliveries)

```

### How Each Participant Moves Through the System

* **Climate / Oracle Role:** Supplies district weather signals, posts yield baselines, and declares drought triggers where configured.
* **Playbook Author:** Claims test **HVST** (via faucet/grants), stakes **HVST** on a district/crop/season playbook, and earns bonus **HVST** or faces stake slashing upon settlement.
* **Field Officer & Co-op Chairperson:** The officer records deliveries; the chairperson adds hashed member codes, confirms deliveries (two-signer rule), follows district playbooks, and receives **mRWF** escrow payouts + **HVST** mint rewards on settled batches (or can release after the 14-day timeout if the buyer is silent).
* **Buyer:** Funds batch escrow in **mRWF** and releases payment upon delivery/batch settlement.
* **Agro-Dealer:** Redeems non-transferable input vouchers within the valid planting window for **mRWF** settlement.
* **Auditor:** Reviews and flags questionable deliveries so invalid records cannot enter clean batch settlement.