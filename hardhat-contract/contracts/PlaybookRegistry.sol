// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CooperativeRegistry} from "./CooperativeRegistry.sol";
import {HarvestLedger, IHVSTMint} from "./HarvestLedger.sol";

/// @title PlaybookRegistry ("copy-farming")
/// @notice Authors publish district-specific farming playbooks and stake HVST on them. Cooperatives in that district
///         follow them. After harvest, verified yield from HarvestLedger is compared with the district BASELINE
///         (posted by DataSpark's oracle) so shared weather luck does not get rewarded.
/// @dev    Advice only, never auto-execution. Yield uses all confirmed deliveries of that crop+season by the
///         followers (a known simplification for this prototype).
contract PlaybookRegistry is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum Status { Active, Rewarded, Neutral, Slashed, Inconclusive }

    struct PublishParams {
        string district;
        string crop;
        uint16 season;
        string uri; // off-chain steps (IPFS CID or DataSpark URL)
        bytes32 dataHash; // fingerprint of the climate data the advice was based on
        uint256 stake;
        uint64 followDeadline;
        uint64 settleAfter;
    }

    struct Playbook {
        address author;
        string district;
        bytes32 districtKey;
        string crop;
        bytes32 cropKey;
        uint16 season;
        string uri;
        bytes32 dataHash;
        uint256 stake;
        uint64 followDeadline;
        uint64 settleAfter;
        Status status;
        uint32 followerCount;
        uint32 totalAres;
        int256 resultBps; // yield vs baseline in basis points (+1500 = 15% above baseline)
        uint32 resultYieldKgHa;
    }

    struct Follow {
        uint256 coopId;
        uint32 areaAres;
        address recordedBy; // wallet that registered the follow (any wallet may do it)
    }

    uint256 public constant MAX_REWARD_BPS = 5000; // reward / slash capped at 50% of stake
    uint256 public constant SLASH_THRESHOLD_BPS = 1000; // underperform by >10% to lose stake

    IERC20 public immutable hvstToken;
    IHVSTMint public immutable hvstMint;
    HarvestLedger public immutable ledger;
    CooperativeRegistry public immutable registry;
    address public insurancePool; // slashed stake goes here (climate-insurance pool)

    uint256 public minStake = 100 ether;
    uint32 public minFollowers = 2;
    uint256 public playbookCount;

    mapping(uint256 => Playbook) private _playbooks;
    mapping(uint256 => Follow[]) private _followers;
    mapping(uint256 => mapping(uint256 => bool)) public hasFollowed; // playbookId => coopId => bool
    mapping(address => int256) public authorScore;
    /// baseline yield (kg per hectare): districtKey => cropKey => season
    mapping(bytes32 => mapping(bytes32 => mapping(uint16 => uint32))) public baseline;

    event PlaybookPublished(uint256 indexed id, address indexed author, string district, string crop, uint16 season, uint256 stake);
    event PlaybookFollowed(uint256 indexed id, uint256 indexed coopId, uint32 areaAres, address indexed follower);
    event BaselineSet(bytes32 indexed districtKey, bytes32 indexed cropKey, uint16 season, uint32 kgPerHa);
    event PlaybookSettled(uint256 indexed id, Status status, int256 resultBps, uint256 reward, uint256 slashed);

    constructor(
        IERC20 _hvst,
        IHVSTMint _hvstMint,
        HarvestLedger _ledger,
        CooperativeRegistry _registry,
        address _insurancePool,
        address admin
    ) {
        hvstToken = _hvst;
        hvstMint = _hvstMint;
        ledger = _ledger;
        registry = _registry;
        insurancePool = _insurancePool;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    // ---------- admin / oracle ----------
    function setParams(uint256 _minStake, uint32 _minFollowers, address _insurancePool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minStake = _minStake;
        minFollowers = _minFollowers;
        insurancePool = _insurancePool;
    }

    function setBaseline(bytes32 districtKey, bytes32 cropKey, uint16 season, uint32 kgPerHa) external onlyRole(ORACLE_ROLE) {
        baseline[districtKey][cropKey][season] = kgPerHa;
        emit BaselineSet(districtKey, cropKey, season, kgPerHa);
    }

    // ---------- authors ----------
    function publish(PublishParams calldata p) external nonReentrant returns (uint256 id) {
        require(bytes(p.district).length > 0 && bytes(p.crop).length > 0, "empty district/crop");
        require(p.stake >= minStake, "stake too low");
        require(p.followDeadline > block.timestamp && p.settleAfter > p.followDeadline, "bad dates");
        id = ++playbookCount;
        Playbook storage pb = _playbooks[id];
        pb.author = msg.sender;
        pb.district = p.district;
        pb.districtKey = keccak256(bytes(p.district));
        pb.crop = p.crop;
        pb.cropKey = keccak256(bytes(p.crop));
        pb.season = p.season;
        pb.uri = p.uri;
        pb.dataHash = p.dataHash;
        pb.stake = p.stake;
        pb.followDeadline = p.followDeadline;
        pb.settleAfter = p.settleAfter;
        hvstToken.safeTransferFrom(msg.sender, address(this), p.stake);
        emit PlaybookPublished(id, msg.sender, p.district, p.crop, p.season, p.stake);
    }

    // ---------- cooperatives ----------
    /// @notice Adopts a farming plan for a cooperative. ANY connected wallet may call this: a farmer, an officer,
    ///         the chairperson or a DataSpark admin. The caller passes the cooperative id explicitly; the contract
    ///         only checks that the cooperative is real (verified + active) and in the plan's district. Following is
    ///         tracked per cooperative, so the same cooperative cannot be counted twice.
    function follow(uint256 id, uint256 coopId, uint32 areaAres) external {
        Playbook storage pb = _playbooks[id];
        require(pb.author != address(0) && pb.status == Status.Active, "not followable");
        require(block.timestamp <= pb.followDeadline, "follow window closed");
        require(coopId != 0 && registry.isVerifiedActive(coopId), "coop not verified");
        require(registry.districtKeyOf(coopId) == pb.districtKey, "wrong district");
        require(!hasFollowed[id][coopId], "already following");
        require(areaAres > 0, "area required");
        hasFollowed[id][coopId] = true;
        _followers[id].push(Follow(coopId, areaAres, msg.sender));
        pb.followerCount += 1;
        pb.totalAres += areaAres;
        emit PlaybookFollowed(id, coopId, areaAres, msg.sender);
    }

    /// @notice Cooperative ids that already adopted this plan, so clients can tell who is following what.
    function followersOf(uint256 id) external view returns (Follow[] memory) {
        return _followers[id];
    }

    // ---------- settlement ----------
    function settle(uint256 id) external nonReentrant {
        Playbook storage pb = _playbooks[id];
        require(pb.author != address(0) && pb.status == Status.Active, "not settleable");
        require(block.timestamp >= pb.settleAfter, "too early");

        uint256 reward;
        uint256 slashed;

        if (pb.followerCount < minFollowers) {
            pb.status = Status.Inconclusive; // not enough evidence: no reward, no penalty
        } else {
            uint32 base = baseline[pb.districtKey][pb.cropKey][pb.season];
            require(base > 0, "baseline missing");
            uint256 totalKg;
            Follow[] storage fs = _followers[id];
            for (uint256 i = 0; i < fs.length; i++) {
                totalKg += ledger.coopSeasonKg(fs[i].coopId, pb.season, pb.cropKey);
            }
            uint256 yieldKgHa = (totalKg * 100) / pb.totalAres; // 100 ares = 1 ha
            pb.resultYieldKgHa = uint32(yieldKgHa > type(uint32).max ? type(uint32).max : yieldKgHa);
            int256 bps = ((int256(yieldKgHa) - int256(uint256(base))) * 10_000) / int256(uint256(base));
            pb.resultBps = bps;

            if (bps >= 0) {
                pb.status = Status.Rewarded;
                uint256 capped = uint256(bps) > MAX_REWARD_BPS ? MAX_REWARD_BPS : uint256(bps);
                reward = (pb.stake * capped) / 10_000;
                authorScore[pb.author] += bps;
            } else if (uint256(-bps) <= SLASH_THRESHOLD_BPS) {
                pb.status = Status.Neutral;
            } else {
                pb.status = Status.Slashed;
                uint256 capped = uint256(-bps) > MAX_REWARD_BPS ? MAX_REWARD_BPS : uint256(-bps);
                slashed = (pb.stake * capped) / 10_000;
                authorScore[pb.author] += bps;
            }
        }

        hvstToken.safeTransfer(pb.author, pb.stake - slashed);
        if (slashed > 0) hvstToken.safeTransfer(insurancePool, slashed);
        if (reward > 0) {
            try hvstMint.mint(pb.author, reward) {} catch { reward = 0; }
        }
        emit PlaybookSettled(id, pb.status, pb.resultBps, reward, slashed);
    }

    // ---------- views ----------
    function getPlaybook(uint256 id) external view returns (Playbook memory) {
        return _playbooks[id];
    }
}
