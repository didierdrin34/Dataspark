// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CooperativeRegistry} from "./CooperativeRegistry.sol";

interface IHVSTMint {
    function mint(address to, uint256 amount) external;
}

/// @title HarvestLedger
/// @notice Supply-chain record for cooperative harvests + buyer escrow with automatic split by kg share.
///
/// Flow:  officer records delivery -> chair confirms (2nd signer) -> batch sealed -> buyer funds escrow
///        -> buyer releases (or coop claims after timeout) -> payment splits by kg share, HVST reward minted.
///
/// Rewards are minted only when a batch is actually PAID (a real sale), which makes fake-delivery farming
/// expensive. Auditors can flag a delivery, removing its kg and reducing the cooperative's score.
contract HarvestLedger is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    enum BatchStatus { Open, Sealed, Funded, Released, Refunded }

    struct Batch {
        uint256 coopId;
        string crop; // lowercase, e.g. "maize"
        bytes32 cropKey; // keccak256(bytes(crop))
        uint16 season; // year*10 + index: 20261 = 2026 Season A, 20262 = Season B ...
        uint32 totalKg;
        BatchStatus status;
        address buyer;
        uint256 amount; // escrowed amount in payToken (mRWF on testnet)
        uint64 fundedAt;
        uint32 pendingDeliveries;
    }

    struct Delivery {
        uint256 batchId;
        bytes32 memberId;
        uint32 kg;
        uint8 grade; // 1 = A (best), 2 = B, 3 = C
        uint64 recordedAt;
        address recordedBy;
        bool confirmed;
        bool flagged;
    }

    CooperativeRegistry public immutable registry;
    IERC20 public immutable payToken;
    IHVSTMint public immutable hvst;

    uint256 public constant RELEASE_TIMEOUT = 14 days;
    uint256 public constant MAX_MEMBERS_PER_BATCH = 150;

    uint256 public batchCount;
    uint256 public deliveryCount;
    uint256 public rewardPerKg = 0.1 ether; // HVST minted per kg on a paid batch
    bool public twoSignerRequired = true; // can be disabled for single-wallet testnet demos

    mapping(uint256 => Batch) private _batches;
    mapping(uint256 => Delivery) private _deliveries;
    mapping(uint256 => bytes32[]) private _batchMembers;
    mapping(uint256 => mapping(bytes32 => uint32)) public batchMemberKg;
    mapping(uint256 => mapping(bytes32 => uint256)) public batchMemberPayout;
    /// verified kg per coop / season / crop: the "proof" used by PlaybookRegistry
    mapping(uint256 => mapping(uint16 => mapping(bytes32 => uint32))) public coopSeasonKg;
    mapping(uint256 => int256) public coopScore;

    event BatchCreated(uint256 indexed batchId, uint256 indexed coopId, string crop, uint16 season);
    event DeliveryRecorded(uint256 indexed deliveryId, uint256 indexed batchId, bytes32 indexed memberId, uint32 kg, uint8 grade);
    event DeliveryConfirmed(uint256 indexed deliveryId, address indexed confirmer);
    event DeliveryFlagged(uint256 indexed deliveryId, address indexed auditor);
    event BatchSealed(uint256 indexed batchId, uint32 totalKg);
    event BatchFunded(uint256 indexed batchId, address indexed buyer, uint256 amount);
    event PaymentSplit(uint256 indexed batchId, bytes32 indexed memberId, uint256 amount);
    event BatchReleased(uint256 indexed batchId, uint256 amount, uint256 hvstReward);
    event BatchRefunded(uint256 indexed batchId, address indexed buyer, uint256 amount);

    constructor(CooperativeRegistry _registry, IERC20 _payToken, IHVSTMint _hvst, address admin) {
        registry = _registry;
        payToken = _payToken;
        hvst = _hvst;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AUDITOR_ROLE, admin);
    }

    // ---------- admin ----------
    function setRewardPerKg(uint256 v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardPerKg = v;
    }

    function setTwoSignerRequired(bool v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        twoSignerRequired = v;
    }

    // ---------- cooperative staff ----------
    function createBatch(uint256 coopId, string calldata crop, uint16 season) external returns (uint256 id) {
        require(registry.isStaff(coopId, msg.sender), "not staff");
        require(registry.isVerifiedActive(coopId), "coop not verified");
        require(bytes(crop).length > 0 && season > 0, "bad crop/season");
        id = ++batchCount;
        Batch storage b = _batches[id];
        b.coopId = coopId;
        b.crop = crop;
        b.cropKey = keccak256(bytes(crop));
        b.season = season;
        emit BatchCreated(id, coopId, crop, season);
    }

    function recordDelivery(uint256 batchId, bytes32 memberId, uint32 kg, uint8 grade) external returns (uint256 id) {
        Batch storage b = _batches[batchId];
        require(b.coopId != 0, "unknown batch");
        require(registry.isStaff(b.coopId, msg.sender), "not staff");
        require(b.status == BatchStatus.Open, "batch not open");
        require(registry.memberPlotAres(b.coopId, memberId) > 0, "not a member");
        require(kg > 0 && grade >= 1 && grade <= 3, "bad kg/grade");
        id = ++deliveryCount;
        _deliveries[id] = Delivery(batchId, memberId, kg, grade, uint64(block.timestamp), msg.sender, false, false);
        b.pendingDeliveries += 1;
        emit DeliveryRecorded(id, batchId, memberId, kg, grade);
    }

    /// @notice Second signature: only the cooperative chair can confirm, and (if required) not the same wallet that recorded it.
    function confirmDelivery(uint256 deliveryId) external {
        Delivery storage d = _deliveries[deliveryId];
        require(d.batchId != 0, "unknown delivery");
        Batch storage b = _batches[d.batchId];
        require(registry.chairOf(b.coopId) == msg.sender, "only chair");
        require(!d.confirmed && !d.flagged, "already handled");
        require(b.status == BatchStatus.Open, "batch not open");
        if (twoSignerRequired) require(d.recordedBy != msg.sender, "needs second signer");

        d.confirmed = true;
        b.pendingDeliveries -= 1;
        if (batchMemberKg[d.batchId][d.memberId] == 0) {
            require(_batchMembers[d.batchId].length < MAX_MEMBERS_PER_BATCH, "batch full");
            _batchMembers[d.batchId].push(d.memberId);
        }
        batchMemberKg[d.batchId][d.memberId] += d.kg;
        b.totalKg += d.kg;
        coopSeasonKg[b.coopId][b.season][b.cropKey] += d.kg;
        coopScore[b.coopId] += 1;
        emit DeliveryConfirmed(deliveryId, msg.sender);
    }

    function sealBatch(uint256 batchId) external {
        Batch storage b = _batches[batchId];
        require(b.coopId != 0 && registry.isStaff(b.coopId, msg.sender), "not staff");
        require(b.status == BatchStatus.Open, "not open");
        require(b.pendingDeliveries == 0, "unconfirmed deliveries");
        require(b.totalKg > 0, "empty batch");
        b.status = BatchStatus.Sealed;
        emit BatchSealed(batchId, b.totalKg);
    }

    // ---------- buyer ----------
    function fundBatch(uint256 batchId, uint256 amount) external nonReentrant {
        Batch storage b = _batches[batchId];
        require(b.status == BatchStatus.Sealed, "not sealed");
        require(amount > 0, "zero amount");
        b.status = BatchStatus.Funded;
        b.buyer = msg.sender;
        b.amount = amount;
        b.fundedAt = uint64(block.timestamp);
        payToken.safeTransferFrom(msg.sender, address(this), amount);
        emit BatchFunded(batchId, msg.sender, amount);
    }

    /// @notice Buyer confirms receipt. If the buyer stays silent for 14 days the cooperative chair can release it
    ///         (protects farmers from late payment games).
    function releaseBatch(uint256 batchId) external nonReentrant {
        Batch storage b = _batches[batchId];
        require(b.status == BatchStatus.Funded, "not funded");
        address chair = registry.chairOf(b.coopId);
        require(
            msg.sender == b.buyer || (msg.sender == chair && block.timestamp >= uint256(b.fundedAt) + RELEASE_TIMEOUT),
            "not allowed yet"
        );
        require(b.totalKg > 0, "no verified kg: ask admin to refund");
        b.status = BatchStatus.Released;

        bytes32[] storage members = _batchMembers[batchId];
        uint256 n = members.length;
        uint256 distributed;
        uint256 firstPaid = type(uint256).max;
        for (uint256 i = 0; i < n; i++) {
            uint32 kg = batchMemberKg[batchId][members[i]];
            if (kg == 0) continue;
            uint256 share = (b.amount * kg) / b.totalKg;
            batchMemberPayout[batchId][members[i]] = share;
            distributed += share;
            if (firstPaid == type(uint256).max) firstPaid = i;
        }
        // give rounding dust to the first paid member so the full escrow is accounted for
        batchMemberPayout[batchId][members[firstPaid]] += b.amount - distributed;
        for (uint256 i = 0; i < n; i++) {
            uint256 p = batchMemberPayout[batchId][members[i]];
            if (p > 0) emit PaymentSplit(batchId, members[i], p);
        }

        // Cooperative receives the full amount and pays each farmer their share via mobile money (RWF).
        payToken.safeTransfer(chair, b.amount);

        uint256 reward = uint256(b.totalKg) * rewardPerKg;
        if (reward > 0) {
            try hvst.mint(chair, reward) {} catch { reward = 0; }
        }
        coopScore[b.coopId] += 5;
        emit BatchReleased(batchId, b.amount, reward);
    }

    // ---------- audit & disputes ----------
    function flagDelivery(uint256 deliveryId) external onlyRole(AUDITOR_ROLE) {
        Delivery storage d = _deliveries[deliveryId];
        require(d.confirmed && !d.flagged, "cannot flag");
        Batch storage b = _batches[d.batchId];
        require(b.status != BatchStatus.Released && b.status != BatchStatus.Refunded, "batch settled");
        d.flagged = true;
        batchMemberKg[d.batchId][d.memberId] -= d.kg;
        b.totalKg -= d.kg;
        coopSeasonKg[b.coopId][b.season][b.cropKey] -= d.kg;
        coopScore[b.coopId] -= 10;
        emit DeliveryFlagged(deliveryId, msg.sender);
    }

    function refundBatch(uint256 batchId) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        Batch storage b = _batches[batchId];
        require(b.status == BatchStatus.Funded, "not funded");
        b.status = BatchStatus.Refunded;
        payToken.safeTransfer(b.buyer, b.amount);
        emit BatchRefunded(batchId, b.buyer, b.amount);
    }

    // ---------- views ----------
    function getBatch(uint256 id) external view returns (Batch memory) {
        return _batches[id];
    }

    function getDelivery(uint256 id) external view returns (Delivery memory) {
        return _deliveries[id];
    }

    function batchMembers(uint256 id) external view returns (bytes32[] memory) {
        return _batchMembers[id];
    }
}
