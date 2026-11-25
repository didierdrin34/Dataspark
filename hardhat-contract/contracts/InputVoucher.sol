// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CooperativeRegistry} from "./CooperativeRegistry.sol";

/// @title InputVoucher (climate-aware input credit)
/// @notice Spend-only, NON-transferable credit for fertilizer / seed. Vouchers carry a time window so seed credit
///         only works in the right planting window, and DataSpark's oracle can release emergency vouchers after a
///         declared climate trigger (drought / flood) in a district: parametric support.
///         Dealers redeem on behalf of farmers and are settled from a reserve.
contract InputVoucher is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE"); // ministry / funder / DataSpark planning
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // DataSpark climate oracle
    bytes32 public constant DEALER_ADMIN_ROLE = keccak256("DEALER_ADMIN_ROLE");

    uint256 public constant TRIGGER_VALIDITY = 30 days;

    struct Voucher {
        uint128 amount; // remaining value in payToken units (mRWF on testnet)
        uint64 notBefore;
        uint64 expiresAt;
        bytes32 category; // keccak256("seed") / keccak256("fertilizer") / ...
        bytes32 reason; // 0 for planned vouchers, trigger reason for emergency ones
        bool emergency;
    }

    struct Dealer {
        string name;
        bool active;
        uint256 owed;
    }

    CooperativeRegistry public immutable registry;
    IERC20 public immutable payToken;

    mapping(bytes32 => Voucher[]) private _vouchers; // key = keccak256(coopId, memberId)
    mapping(address => Dealer) public dealers;
    mapping(bytes32 => uint64) public triggerAt; // keccak256(districtKey, reason) => timestamp

    event VoucherIssued(uint256 indexed coopId, bytes32 indexed memberId, uint256 index, uint128 amount, bytes32 category, bool emergency);
    event ClimateTrigger(bytes32 indexed districtKey, bytes32 indexed reason, uint8 severity, bytes32 evidenceHash);
    event Redeemed(uint256 indexed coopId, bytes32 indexed memberId, address indexed dealer, uint256 index, uint256 amount, bytes32 itemCode);
    event ReserveFunded(address indexed from, uint256 amount);
    event DealerSettled(address indexed dealer, uint256 amount);

    constructor(CooperativeRegistry _registry, IERC20 _payToken, address admin) {
        registry = _registry;
        payToken = _payToken;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
        _grantRole(DEALER_ADMIN_ROLE, admin);
    }

    function _key(uint256 coopId, bytes32 memberId) private pure returns (bytes32) {
        return keccak256(abi.encode(coopId, memberId));
    }

    // ---------- dealers ----------
    function setDealer(address dealer, string calldata name, bool active) external onlyRole(DEALER_ADMIN_ROLE) {
        dealers[dealer].name = name;
        dealers[dealer].active = active;
    }

    // ---------- issuing ----------
    function issueBatch(
        uint256 coopId,
        bytes32[] calldata memberIds,
        uint128[] calldata amounts,
        bytes32 category,
        uint64 notBefore,
        uint64 expiresAt
    ) external onlyRole(ISSUER_ROLE) {
        require(expiresAt > block.timestamp && expiresAt > notBefore, "bad window");
        _issue(coopId, memberIds, amounts, category, notBefore, expiresAt, bytes32(0), false);
    }

    /// @notice Oracle declares a climate trigger for a district (evidenceHash = fingerprint of the data snapshot).
    function declareTrigger(bytes32 districtKey, bytes32 reason, uint8 severity, bytes32 evidenceHash) external onlyRole(ORACLE_ROLE) {
        triggerAt[keccak256(abi.encode(districtKey, reason))] = uint64(block.timestamp);
        emit ClimateTrigger(districtKey, reason, severity, evidenceHash);
    }

    /// @notice Emergency vouchers, only allowed in a district with a recent declared trigger for `reason`.
    function issueEmergency(
        uint256 coopId,
        bytes32[] calldata memberIds,
        uint128[] calldata amounts,
        bytes32 reason,
        uint64 expiresAt
    ) external onlyRole(ORACLE_ROLE) {
        uint64 t = triggerAt[keccak256(abi.encode(registry.districtKeyOf(coopId), reason))];
        require(t != 0 && block.timestamp <= uint256(t) + TRIGGER_VALIDITY, "no active trigger");
        require(expiresAt > block.timestamp, "bad window");
        _issue(coopId, memberIds, amounts, keccak256("emergency-inputs"), uint64(block.timestamp), expiresAt, reason, true);
    }

    function _issue(
        uint256 coopId,
        bytes32[] calldata memberIds,
        uint128[] calldata amounts,
        bytes32 category,
        uint64 notBefore,
        uint64 expiresAt,
        bytes32 reason,
        bool emergency
    ) private {
        require(registry.isVerifiedActive(coopId), "coop not verified");
        require(memberIds.length == amounts.length && memberIds.length > 0, "length mismatch");
        for (uint256 i = 0; i < memberIds.length; i++) {
            require(registry.memberPlotAres(coopId, memberIds[i]) > 0, "not a member");
            Voucher[] storage list = _vouchers[_key(coopId, memberIds[i])];
            list.push(Voucher(amounts[i], notBefore, expiresAt, category, reason, emergency));
            emit VoucherIssued(coopId, memberIds[i], list.length - 1, amounts[i], category, emergency);
        }
    }

    // ---------- redeeming & settlement ----------
    function redeem(uint256 coopId, bytes32 memberId, uint256 index, uint128 amount, bytes32 itemCode) external {
        require(dealers[msg.sender].active, "not an active dealer");
        Voucher storage v = _vouchers[_key(coopId, memberId)][index];
        require(block.timestamp >= v.notBefore, "not yet usable");
        require(block.timestamp <= v.expiresAt, "expired");
        require(amount > 0 && amount <= v.amount, "bad amount");
        v.amount -= amount;
        dealers[msg.sender].owed += amount;
        emit Redeemed(coopId, memberId, msg.sender, index, amount, itemCode);
    }

    function fundReserve(uint256 amount) external {
        payToken.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    function claimSettlement() external nonReentrant {
        Dealer storage d = dealers[msg.sender];
        uint256 available = payToken.balanceOf(address(this));
        uint256 pay = d.owed < available ? d.owed : available;
        require(pay > 0, "nothing to settle");
        d.owed -= pay;
        payToken.safeTransfer(msg.sender, pay);
        emit DealerSettled(msg.sender, pay);
    }

    // ---------- views ----------
    function vouchersOf(uint256 coopId, bytes32 memberId) external view returns (Voucher[] memory) {
        return _vouchers[_key(coopId, memberId)];
    }

    /// @notice Sum of currently usable (started, not expired) voucher value.
    function usableBalance(uint256 coopId, bytes32 memberId) external view returns (uint256 total) {
        Voucher[] storage list = _vouchers[_key(coopId, memberId)];
        for (uint256 i = 0; i < list.length; i++) {
            if (block.timestamp >= list[i].notBefore && block.timestamp <= list[i].expiresAt) total += list[i].amount;
        }
    }
}
