# DataSpark + HVST (Sepolia)

```
hardhat-contract/   Solidity contracts, deploy + verify scripts, tests
frontend/           Files to drop into your Next.js app (app router, Tailwind, wagmi + viem)
```

## 1. Contracts
```bash
cd hardhat-contract
npm install
cp .env.example .env          # add SEPOLIA_RPC_URL + a THROWAWAY wallet key funded from a Sepolia faucet
npx hardhat test              # end-to-end test
npm run deploy:sepolia        # deploys everything, wires roles, seeds a Nyagatare demo cooperative,
                              # and writes ../frontend/lib/deployments.json
npm run verify                # optional: publish source on Etherscan (needs ETHERSCAN_API_KEY)
```

## 2. Frontend
```bash
npm i wagmi viem @tanstack/react-query
npm uninstall html2canvas     # no longer used
```
- Copy `frontend/` files into your project (same folder names). `@/` must map to the project root in `tsconfig.json`
  (default in create-next-app is `./src/*`; if you use `src/`, copy into `src/` or change the alias).
- Append `frontend/app/globals.css.append` to your `app/globals.css`.
- Replace `firebaseApp.js`, add the variables from `.env.local.example` to `.env.local`.
- `lib/rwandaDistrict.ts` and `lib/weatherCode.ts` are unchanged.
- The old `DistrictClimateForecast` component is replaced by `ForecastPanel` + `Hotspots` + `PlaybookPanel`.

## 3. Demo flow
1. Connect a wallet on Sepolia. Cooperative desk: your demo cooperative (#1, Nyagatare) is owned by the deployer wallet.
2. Create a batch, record deliveries for RW-NYA-0001..0005, confirm them, seal the batch.
3. Get test mRWF, fund escrow, release it, and watch the payout split by kg.
4. Farming plans page: get test HVST, publish a farming plan, follow it as the cooperative.






PS C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract> npx hardhat run .\scripts\deploy.js --network sepolia
Compiled 23 Solidity files successfully (evm target: paris).
Network: sepolia (chainId 11155111)
Deployer: 0xa48099868525fEd9b4B7B9d98FC26AB3e62b3E7e  balance: 7.97341782211634064 ETH

Deploying...
  MockRWF              0x4af2d34b85fa88E15E9be1cef3Df3465d04C431b
  HVST                 0x24535681c54277A5898264e8c605054fDDE18336
  CooperativeRegistry  0x027D799356C5d24fe601A80DE5E1F69282B71F2d
  HarvestLedger        0x5c3C5655Ba3E3306252b3eB95e580F8DBB0bD186
  PlaybookRegistry     0xE293A57110eEb64072Cf7FCf60952eA2d336652e
  InputVoucher         0x06FC30287d1D092Bf486495a845dD783A7cB8563
  HVSTFaucet           0x30a6735e3123e669B99f28cfec633416f6FcC1aC

Wiring roles...
  roles granted, faucet funded

Seeding demo data...
ProviderError: in-flight transaction limit reached for delegated accounts
    at HttpProvider.request (C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract\node_modules\hardhat\src\internal\core\providers\http.ts:116:21)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at HardhatEthersSigner.sendTransaction (C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract\node_modules\@nomicfoundation\hardhat-ethers\src\signers.ts:193:18)
    at send (C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract\node_modules\ethers\src.ts\contract\contract.ts:313:20)
    at Proxy.registerCooperative (C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract\node_modules\ethers\src.ts\contract\contract.ts:352:16)
    at main (C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract\scripts\deploy.js:61:12)
PS C:\Users\nsedd\Documents\Misc\ALU specialization LLP\alu-low_level_programming\Blockchain 2\Dataspark\hardhat-contract> 