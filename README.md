# Intents Flow with ERC-7683 and ZK Proof of Finality

This project will develop a PoC of cross-chain intent address between 3 chains illustrating the flow of:

- The **User**  signs 2 messages following [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612) and allows the transfer of a compatible ERC-20 token along with a `GaslessCrossChainOrder` sufficient for a filler to deploy a contract on source and destination chains.
- The **Filler** validates user’s signed order, deploys ephemeral contracts on source and destination chains, completes bridging, obtains finality proof, and submits proof to unlock escrow and recover fees.

Key background:

- [Cross L2 with Intent Addresses](https://www.youtube.com/watch?v=ioCdBWLmuI8) describes how to use CREATE2 for deterministic ephemeral intent addresses generated by a user, but deployed by fillers that "sponsor the gas".
- [Unifying Ethereum Through Intents and ERC-7683](https://www.youtube.com/watch?v=jjBxfIsTrLE)
  describes [ERC7683](https://www.erc7683.org/spec), using `GaslessCrossChainOrder` to represent off-chain user intent.
- [SP1 Groth proof of finality](https://hackmd.io/F5iI9RfQQoCSFCgXbUalKg) describes how to generate the proof

The solution has all desirable properties:

- **Trust Minimization**: The filler cannot prematurely unlock the user’s tokens on the source chain, because the ephemeral contract checks for a valid SP1 finality proof.
- **Gasless for the User**: The filler pays gas on both chains, recouping costs via a fee.
- **Replay Protection + Deterministic Addressing**: `CREATE2` ensures each ephemeral contract is predictable and unique per user intent. Salt/nonce logic protects against replay.
- **Composability**: Because ephemeral contracts follow the ERC-7683 interface, multiple fillers can compete to fill orders, potentially offering better prices and efficiency.

## User Flow

1. **User Creates an Off-Chain Intent (GaslessCrossChainOrder)**
   
   - The user constructs (off-chain) a data structure conforming to [ERC-7683](https://eips.ethereum.org/EIPS/eip-7683) (e.g. `GaslessCrossChainOrder`) that specifies:
     - Source chain and destination chain.
     - Token to bridge (e.g. USDT).
     - Amount (e.g. 5 USDT).
     - Salt/Nonce (for replay protection).
     - The ephemeral “intent” address that will be used on both chains (computed deterministically using `CREATE2`).
     - Additional parameters like fill fees, expiration time, etc. (to protect the user from indefinite locking of tokens).
   - The user then **signs** this intent following [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612), allowing the contract to transfer the desired amount of tokens.
   - The user (or user’s UI) calls the `IntentFactory` (on each chain) to compute the ephemeral address (using the same salt).
   - Under the hood, the ephemeral address is derived from something like:
     ```solidity
     ephemeralAddress = CREATE2(
       factoryAddress,
       userSalt,
       keccak256(ContractBytecode)
     )
     ```
   - **Important**: The ephemeral contract is _not yet deployed_ at this point, but we already know what the address _will_ be once deployed.

2. **User Approves Token Transfer via EIP-2612**

   - The user approves the ephemeral contract to transfer the desired amount of the ERC20 token (e.g. 5 USDT) by submitting the signed permit.
   - This approval allows the ephemeral contract to pull the tokens when deployed, eliminating the need to manually fund the address.

3. **User Waits for a Filler to Pick Up the Intent**
   
   - From the user’s perspective, once they have signed the permit and published their off-chain order (`GaslessCrossChainOrder`), they are done.
   - The next steps (deploying ephemeral contracts, bridging, finality proof submission) are handled by **Fillers** (a third-party or aggregator who sponsors gas). A **Filler** sees the user’s intent, checks that the ephemeral address is approved, and executes the bridging steps on both chains. They are incentivized by fees or other compensation in the user’s `GaslessCrossChainOrder`.
   - The filler (e.g. a specialized service or aggregator) receives the signed `GaslessCrossChainOrder`.
   - The filler verifies the user signature and checks that the ephemeral address on the source chain is approved for the correct amount of tokens.
   - Since the ephemeral address is precomputed via `CREATE2`, the filler can trigger `IntentFactory.deploy(...)` with the same salt and bytecode.
   - Now the ephemeral address becomes a **real** on-chain contract with code.
   - **Inside this ephemeral contract** is logic that:
     - Holds the user’s tokens in escrow.
     - Will release them to the filler if/when a valid SP1 Groth16 finality proof is submitted (proving the destination chain transfer was finalized).

4. **Filler Executes Bridging to the Destination Chain**
   
   - On the destination chain (e.g. Sepolia), the filler also deploys the **same ephemeral contract** (same salt, same bytecode) via `IntentFactory`.
   - The ephemeral contract on the destination chain handles receiving (or minting) the bridged tokens.
   - The user’s bridging request is thus fulfilled on the destination chain. The tokens can be in the ephemeral contract or directly transferred to the user’s address.

5. **User Receives Tokens on the Destination Chain**
   
   - The ephemeral contract on the destination chain will release (or directly transfer) the bridged tokens (or their equivalent) to the user’s address.
   - If everything goes as intended, the user does not have to directly pay gas on _either_ chain (the filler sponsors gas).

6. **Filler Waits for Destination Finality + Generates SP1 Proof**
   
   - After bridging on the destination chain, the filler waits for finality.
     - That the L2 chain has updated the storage value of the ephemeral contract (e.g. destinationFulfilled=1)
     - That the L2 state root is correct
   - The filler then generates or obtains an **SP1 Groth16 finality proof**, which is cryptographic evidence that the destination chain has finalized the bridging transaction.

7. **Filler Submits the Finality Proof to the Source Chain**
   - The filler calls a function (e.g. `unlockEscrow()`) on the ephemeral contract deployed on the source chain, providing:
     - The SP1 proof.
     - Public inputs (like block number, state root, etc.).
     - Other data required for on-chain verification.
   - The ephemeral contract verifies the proof using the on-chain SP1 verifier contract.
   - Upon successful proof verification, the ephemeral contract **unlocks** the user’s tokens that were in escrow.
   - Typically, these tokens go to the filler (or partially to the filler as a fee), compensating them for sponsoring gas.

8. **Withdraw Function for Unfilled Orders**
   
   - If a filler does not fill the order within a specified timeframe, the user can invoke a `withdraw` function on the ephemeral contract.
   - This function allows the user to retrieve their tokens from escrow, ensuring that their funds are not indefinitely locked due to inaction by the filler.
   - The `withdraw` function includes necessary checks to ensure that only the original user can withdraw and that the withdrawal is only possible after the order has expired.

## Gas Estimation and Filler Fees

- **Gas Estimation:**
  - **Source Chain:** The filler estimates the gas required to deploy the ephemeral contract and execute the necessary functions to lock tokens and initiate the bridge.
  - **Destination Chain:** Similarly, gas is estimated for deploying the ephemeral contract, handling the bridged tokens, and any additional verification steps.
  - Accurate gas estimation ensures that the filler can cover the costs of transactions on both chains without overcharging the user.

- **Filler Fees:**
  - The filler charges a fee for their services, deducted from the bridged tokens on the destination chain:
    - **Stablecoin (USDT):** 0.01% fee
    - **Wrapped BTC (WBTC):** 0.05% fee 
  - These fees compensate the filler for gas expenses and operational costs incurred during the bridging process.
  - Fees are automatically calculated and deducted during the token release phase on the destination chain.


# Next Steps

1. [Smart Contract] Needs to work as described on the same 3 chains in Testnet, with: 
   - MockERC20: add EIP-2612 support and deploy USDT and WBTC on all 3 chains
   - DualChainIntent:  add withdrawal support in the DualIntent contract. 
   - Adjustments to the hardhat test to not have a transfer but instead use the permit pattern so the user never pays for gas

2. [UI] Modify the UI (see `ui`) to 
    - support 2 signing processes using the IntentFactory and posts a JSON blob to https://api.colorfulnotion.com/intents (which will post it after a little bit of validation into a P2P network [here](/network)).   User should be able to specify the network, ERC20 token (a USD and BTC case are enough) and amount. 
    - add the fixed 0.01% (USDT) vs 0.05% markup (BTC) on the destination chain AND your best gas estimate for deploying the source and destination chain computed at the moment of signing.
    - add basic UI elements for observing the filler deploying the contract on the source and destination chain.  Your test process should trigger this. 
   Host this on vercel.  No need to make it super pretty.  Don't do anything with deadlines and withdrawal UI right now, get the signatures right such that the API can verify the signatures and log it.  _Question: Is it possible to combine 2 signing into one signing?_

3. [Demonstrate unlock of escrowed funds] We were not able to test the unlock based on proof, but with test data we have a "destinationFulfilled=true" storage proof -- A valid SP1 proof and ethers.js v5 code to verify it is [here](https://github.com/colorfulnotion/intents/issues/3) which works on Sepolia.  However, we need the SP1Gateway `0x397A5f7f3dBd538f23DE225B51f532c34448dA9B` on OP Stack + Ink Test chain deployed and verified (it already is on Sepolia) not 0x4660483e004e416D41bfd77D6425e98543beB6Ba     Use this sample storage proof and ensure that `originCompleted=true` is observed on the source deployment.

4. [Documentation] Adjust your README to match (1) + (3) in `contracts` and update the README for (2) in `ui`.  
