# 💬 DecentralizedMessaging — Soroban Smart Contract

> A trustless, on-chain private messaging protocol built on **Stellar** using the **Soroban** smart-contract platform.

---

## 📋 Project Description

**DecentralizedMessaging** is a Soroban smart contract that enables wallet-to-wallet private messaging directly on the Stellar blockchain. No central server, no middleman, no single point of failure — every message is stored on-chain, cryptographically tied to its sender and recipient, and only readable by the parties involved.

Built with Rust and the Soroban SDK, the contract is designed to be minimal, gas-efficient, and easy to integrate into any Stellar-based dApp or frontend.

<img width="1919" height="662" alt="image" src="https://github.com/user-attachments/assets/07e659fb-d002-4dea-b066-b915d98ff91f" />

<img width="1919" height="998" alt="image" src="https://github.com/user-attachments/assets/fa227afb-b652-4b2f-a525-1fcd07a8374e" />

---

## 🔍 What It Does

When deployed, the contract acts as a decentralised message registry:

1. **Alice** calls `send_message(alice, bob, "Hello!")` — she authorises with her wallet, and the message is stored on-chain with a unique ID, a timestamp, and a `read: false` flag.
2. **Bob** calls `get_inbox(bob)` to retrieve a list of message IDs addressed to him.
3. Bob calls `get_message(bob, msg_id)` to fetch the full content of any individual message.
4. Bob calls `mark_read(bob, msg_id)` to flag the message as read.
5. Either party can query `unread_count` to see pending messages at any time.

All operations require **wallet authorisation** (`require_auth`), so nobody can impersonate a sender or peek into someone else's inbox.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📨 **Send Messages** | Send a text message (≤ 500 chars) to any Stellar address |
| 📥 **Inbox** | Retrieve all incoming message IDs for your address |
| 📤 **Sent Box** | Retrieve all outgoing message IDs you have sent |
| 👁️ **Read Messages** | Fetch full message content — restricted to sender & recipient only |
| ✅ **Mark as Read** | Recipient can mark messages as read; tracks read/unread state |
| 🔔 **Unread Count** | Efficiently query how many unread messages are waiting |
| 🔢 **Message Counter** | Global counter tracking total messages ever sent on the contract |
| 🛡️ **Auth-Gated** | Every function requires `require_auth()` — no impersonation possible |
| 🚫 **Self-Message Guard** | Prevents sending a message to yourself |
| 📏 **Content Validation** | Rejects empty messages and messages over 500 characters |
| 👑 **Admin Role** | Contract owner can be transferred via `transfer_admin` |
| 🧪 **Full Test Suite** | Unit tests covering all happy paths and edge cases |

---

## 🏗️ Project Structure

```
decentralized-messaging/
├── Cargo.toml          # Rust package manifest & Soroban dependencies
└── src/
    └── lib.rs          # Contract logic, data types, and tests
```

---

## 🚀 Getting Started

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WASM target
rustup target add wasm32-unknown-unknown

# Install the Stellar CLI
cargo install --locked stellar-cli --features opt
```

### Build

```bash
cd decentralized-messaging

# Compile to WASM
stellar contract build
```

The compiled `.wasm` file will appear at:
`target/wasm32-unknown-unknown/release/decentralized_messaging.wasm`

### Run Tests

```bash
cargo test --features testutils
```

### Deploy to Testnet

```bash
# Generate a new keypair (or use an existing one)
stellar keys generate --global alice --network testnet

# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/decentralized_messaging.wasm \
  --source alice \
  --network testnet

# Initialise (replace CONTRACT_ID and ADMIN_ADDRESS)
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- initialize \
  --admin ADMIN_ADDRESS
```

---

## 📡 Contract Interface

### `initialize(admin: Address)`
Sets up the contract and assigns an admin. Can only be called once.

### `send_message(sender, recipient, content) → u64`
Sends a message and returns its unique ID. Requires sender auth.

### `get_message(caller, msg_id) → Message`
Returns the full message struct. Only sender or recipient may call this.

### `mark_read(caller, msg_id)`
Marks a message as read. Only the recipient may call this.

### `get_inbox(owner) → Vec<u64>`
Returns the list of message IDs in the caller's inbox.

### `get_sent(owner) → Vec<u64>`
Returns the list of message IDs the caller has sent.

### `unread_count(owner) → u32`
Returns the number of unread messages in the caller's inbox.

### `total_messages() → u64`
Returns the global message count (public, no auth needed).

### `get_admin() → Address`
Returns the current admin address.

### `transfer_admin(current_admin, new_admin)`
Transfers admin rights. Requires current admin auth.

---

## 📦 Data Types

```rust
pub struct Message {
    pub id:        u64,
    pub sender:    Address,
    pub recipient: Address,
    pub content:   String,   // max 500 characters
    pub timestamp: u64,      // ledger timestamp (Unix seconds)
    pub read:      bool,
}
```

---

## 🔗 Deployed Smart Contract

**Network:** Stellar Testnet  
**Contract ID:** CASOLRBTXEUIZTSST55FRTWKN22FIQXBEXMSWO24GUZHXRYNOU2AUFPY  
**Explorer:** https://stellar.expert/explorer/testnet/contract/CASOLRBTXEUIZTSST55FRTWKN22FIQXBEXMSWO24GUZHXRYNOU2AUFPY


---

## 🛣️ Roadmap

- [ ] Message deletion / retraction
- [ ] End-to-end encryption (off-chain key exchange + on-chain ciphertext storage)
- [ ] Group messaging / broadcast channels
- [ ] Message expiry (TTL-based auto-deletion via ledger entry bumping)
- [ ] Frontend dApp (React + Freighter wallet integration)
- [ ] Mainnet deployment

---

## 📄 License

MIT © 2025 — Free to use, modify, and deploy.
