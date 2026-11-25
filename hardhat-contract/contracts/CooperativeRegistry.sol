// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CooperativeRegistry
/// @notice Rwandan cooperatives are the on-chain actors; farmers are hashed member IDs inside them.
///         No personal data is stored on-chain: names / phone numbers stay in DataSpark's database.
contract CooperativeRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct Cooperative {
        string name;
        string district;
        bytes32 districtKey; // keccak256(bytes(district)), e.g. "Nyagatare"
        address chair; // the cooperative wallet (second signer on deliveries)
        bool verified;
        bool active;
    }

    uint256 public cooperativeCount; // ids start at 1
    mapping(uint256 => Cooperative) private _coops;
    mapping(address => uint256) public coopIdOfChair;
    mapping(uint256 => mapping(address => bool)) public isOfficer;
    /// plot size in ares (100 ares = 1 hectare). 0 means "not a member".
    mapping(uint256 => mapping(bytes32 => uint32)) public memberPlotAres;
    mapping(uint256 => uint256) public memberCount;

    event CooperativeRegistered(uint256 indexed id, string name, string district, address indexed chair);
    event CooperativeVerified(uint256 indexed id, bool verified);
    event CooperativeActive(uint256 indexed id, bool active);
    event OfficerSet(uint256 indexed id, address indexed officer, bool allowed);
    event MemberSet(uint256 indexed id, bytes32 indexed memberId, uint32 plotAres);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    modifier onlyChair(uint256 id) {
        require(_coops[id].chair == msg.sender, "not chair");
        _;
    }

    function registerCooperative(string calldata name, string calldata district) external returns (uint256 id) {
        require(bytes(name).length > 0 && bytes(district).length > 0, "empty name/district");
        require(coopIdOfChair[msg.sender] == 0, "wallet already registered");
        id = ++cooperativeCount;
        _coops[id] = Cooperative(name, district, keccak256(bytes(district)), msg.sender, false, true);
        coopIdOfChair[msg.sender] = id;
        emit CooperativeRegistered(id, name, district, msg.sender);
    }

    function verifyCooperative(uint256 id, bool verified) external onlyRole(VERIFIER_ROLE) {
        require(id != 0 && id <= cooperativeCount, "unknown coop");
        _coops[id].verified = verified;
        emit CooperativeVerified(id, verified);
    }

    function setActive(uint256 id, bool active) external onlyRole(VERIFIER_ROLE) {
        require(id != 0 && id <= cooperativeCount, "unknown coop");
        _coops[id].active = active;
        emit CooperativeActive(id, active);
    }

    function setOfficer(uint256 id, address officer, bool allowed) external onlyChair(id) {
        isOfficer[id][officer] = allowed;
        emit OfficerSet(id, officer, allowed);
    }

    /// @notice Add or update a member. `memberId` should be keccak256 of an off-chain code (e.g. "RW-NYA-0001").
    ///         Passing plotAres = 0 removes the member.
    function setMember(uint256 id, bytes32 memberId, uint32 plotAres) external {
        require(isStaff(id, msg.sender), "not staff");
        require(_coops[id].verified && _coops[id].active, "coop not verified");
        require(memberId != bytes32(0), "bad member");
        bool isNew = memberPlotAres[id][memberId] == 0;
        if (plotAres == 0) {
            require(!isNew, "not a member");
            memberCount[id] -= 1;
        } else if (isNew) {
            memberCount[id] += 1;
        }
        memberPlotAres[id][memberId] = plotAres;
        emit MemberSet(id, memberId, plotAres);
    }

    // ---------- views ----------
    function getCooperative(uint256 id) external view returns (Cooperative memory) {
        return _coops[id];
    }

    function isVerifiedActive(uint256 id) public view returns (bool) {
        return _coops[id].verified && _coops[id].active;
    }

    function chairOf(uint256 id) external view returns (address) {
        return _coops[id].chair;
    }

    function districtKeyOf(uint256 id) external view returns (bytes32) {
        return _coops[id].districtKey;
    }

    function isStaff(uint256 id, address who) public view returns (bool) {
        return _coops[id].chair == who || isOfficer[id][who];
    }
}
