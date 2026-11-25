import { keccak256, parseAbi, toBytes, type Address } from 'viem';
import deployments from './deployments.json';

export const ZERO = '0x0000000000000000000000000000000000000000' as Address;
export const CONTRACTS = deployments.contracts as Record<keyof typeof deployments.contracts, Address>;
export const isDeployed = CONTRACTS.HarvestLedger !== ZERO;
export const EXPLORER = 'https://sepolia.etherscan.io';
export const DEPLOYER = deployments.deployer.toLowerCase() as Address;

export const districtKey = (name: string) => keccak256(toBytes(name));
export const cropKey = (crop: string) => keccak256(toBytes(crop.trim().toLowerCase()));
export const memberKey = (code: string) => keccak256(toBytes(code.trim().toUpperCase()));
export const addressMemberKey = (addr: string) => keccak256(toBytes(addr.trim().toLowerCase()));

export const CROPS = ['maize', 'beans', 'irish potato', 'rice', 'cassava', 'sorghum', 'coffee', 'tea'];

export const seasonId = (year: number, idx: 1 | 2 | 3) => year * 10 + idx;
export const seasonLabel = (s: number) => `${Math.floor(s / 10)} Season ${['', 'A', 'B', 'C'][s % 10] ?? s % 10}`;

export const BATCH_STATUS = ['Open', 'Sealed', 'Funded', 'Released', 'Refunded'] as const;
export const PLAYBOOK_STATUS = ['Active', 'Rewarded', 'Neutral', 'Slashed', 'Inconclusive'] as const;

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const faucetAbi = parseAbi([
  'function drip()',
  'function lastDrip(address) view returns (uint256)',
]);

export const mockRwfAbi = parseAbi([
  'function faucet()',
  'function lastDrip(address) view returns (uint256)',
]);

export const registryAbi = parseAbi([
  'function cooperativeCount() view returns (uint256)',
  'function coopIdOfChair(address) view returns (uint256)',
  'function isOfficer(uint256,address) view returns (bool)',
  'function memberCount(uint256) view returns (uint256)',
  'function memberPlotAres(uint256,bytes32) view returns (uint32)',
  'function getCooperative(uint256) view returns ((string name, string district, bytes32 districtKey, address chair, bool verified, bool active))',
  'function registerCooperative(string name, string district) returns (uint256)',
  'function verifyCooperative(uint256 id, bool verified)',
  'function setActive(uint256 id, bool active)',
  'function setOfficer(uint256 id, address officer, bool allowed)',
  'function setMember(uint256 id, bytes32 memberId, uint32 plotAres)',
  'function isStaff(uint256 id, address who) view returns (bool)',
  'event OfficerSet(uint256 indexed id, address indexed officer, bool allowed)',
]);

export const ledgerAbi = parseAbi([
  'function batchCount() view returns (uint256)',
  'function deliveryCount() view returns (uint256)',
  'function twoSignerRequired() view returns (bool)',
  'function coopScore(uint256) view returns (int256)',
  'function coopSeasonKg(uint256,uint16,bytes32) view returns (uint32)',
  'function batchMemberKg(uint256,bytes32) view returns (uint32)',
  'function batchMemberPayout(uint256,bytes32) view returns (uint256)',
  'function batchMembers(uint256) view returns (bytes32[])',
  'function getBatch(uint256) view returns ((uint256 coopId, string crop, bytes32 cropKey, uint16 season, uint32 totalKg, uint8 status, address buyer, uint256 amount, uint64 fundedAt, uint32 pendingDeliveries))',
  'function getDelivery(uint256) view returns ((uint256 batchId, bytes32 memberId, uint32 kg, uint8 grade, uint64 recordedAt, address recordedBy, bool confirmed, bool flagged))',
  'function createBatch(uint256 coopId, string crop, uint16 season) returns (uint256)',
  'function recordDelivery(uint256 batchId, bytes32 memberId, uint32 kg, uint8 grade) returns (uint256)',
  'function confirmDelivery(uint256 deliveryId)',
  'function sealBatch(uint256 batchId)',
  'function fundBatch(uint256 batchId, uint256 amount)',
  'function releaseBatch(uint256 batchId)',
  'function setTwoSignerRequired(bool v)',
]);

export const playbookAbi = parseAbi([
  'function playbookCount() view returns (uint256)',
  'function minStake() view returns (uint256)',
  'function authorScore(address) view returns (int256)',
  'function hasFollowed(uint256,uint256) view returns (bool)',
  'function baseline(bytes32,bytes32,uint16) view returns (uint32)',
  'function getPlaybook(uint256) view returns ((address author, string district, bytes32 districtKey, string crop, bytes32 cropKey, uint16 season, string uri, bytes32 dataHash, uint256 stake, uint64 followDeadline, uint64 settleAfter, uint8 status, uint32 followerCount, uint32 totalAres, int256 resultBps, uint32 resultYieldKgHa))',
  'function publish((string district, string crop, uint16 season, string uri, bytes32 dataHash, uint256 stake, uint64 followDeadline, uint64 settleAfter) p) returns (uint256)',
  'function follow(uint256 id, uint32 areaAres)',
  'function settle(uint256 id)',
]);

export const voucherAbi = parseAbi([
  'function usableBalance(uint256 coopId, bytes32 memberId) view returns (uint256)',
  'function vouchersOf(uint256 coopId, bytes32 memberId) view returns ((uint128 amount, uint64 notBefore, uint64 expiresAt, bytes32 category, bytes32 reason, bool emergency)[])',
]);

export interface PlaybookView {
  id: bigint; author: Address; district: string; districtKey: `0x${string}`;
  crop: string; cropKey: `0x${string}`; season: number; uri: string; dataHash: `0x${string}`;
  stake: bigint; followDeadline: bigint; settleAfter: bigint; status: number;
  followerCount: number; totalAres: number; resultBps: bigint; resultYieldKgHa: number;
}

export interface BatchView {
  id: bigint; coopId: bigint; crop: string; cropKey: `0x${string}`; season: number;
  totalKg: number; status: number; buyer: Address; amount: bigint; fundedAt: bigint; pendingDeliveries: number;
}

export interface DeliveryView {
  id: bigint; batchId: bigint; memberId: `0x${string}`; kg: number; grade: number;
  recordedAt: bigint; recordedBy: Address; confirmed: boolean; flagged: boolean;
}

export const short = (s: string, n = 4) => (s.length > 2 * n + 2 ? `${s.slice(0, n + 2)}…${s.slice(-n)}` : s);
