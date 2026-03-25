"use client";

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
  isAllowed,
  requestAccess,
} from "@stellar/freighter-api";

// ============================================================
// CONSTANTS — Update these for your contract
// ============================================================

/** Your deployed Soroban contract ID */
export const CONTRACT_ADDRESS =
  "CAB3YECDYWX4PS7SFK5SCTEX5KFEV6AXLQONM2LTN4TBFV3KWRH4TUTQ";

/** Network passphrase (testnet by default) */
export const NETWORK_PASSPHRASE = Networks.TESTNET;

/** Soroban RPC URL */
export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Horizon URL */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Network name for Freighter */
export const NETWORK = "TESTNET";

// ============================================================
// RPC Server Instance
// ============================================================

const server = new rpc.Server(RPC_URL);

// ============================================================
// Wallet Helpers
// ============================================================

export async function checkConnection(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error("Freighter extension is not installed or not available.");
  }

  const allowedResult = await isAllowed();
  if (!allowedResult.isAllowed) {
    await setAllowed();
    await requestAccess();
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve wallet address from Freighter.");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) return null;

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return null;

    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ============================================================
// Contract Interaction Helpers
// ============================================================

/**
 * Build, simulate, and optionally sign + submit a Soroban contract call.
 *
 * @param method   - The contract method name to invoke
 * @param params   - Array of xdr.ScVal parameters for the method
 * @param caller   - The public key (G...) of the calling account
 * @param sign     - If true, signs via Freighter and submits. If false, only simulates.
 * @returns        The result of the simulation or submission
 */
export async function callContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller: string,
  sign: boolean = true
) {
  const contract = new Contract(CONTRACT_ADDRESS);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${(simulated as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  if (!sign) {
    // Read-only call — just return the simulation result
    return simulated;
  }

  // Prepare the transaction with the simulation result
  const prepared = rpc.assembleTransaction(tx, simulated).build();

  // Sign with Freighter
  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const result = await server.sendTransaction(txToSubmit);

  if (result.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${result.status}`);
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "FAILED") {
    throw new Error("Transaction failed on chain.");
  }

  return getResult;
}

/**
 * Read-only contract call (does not require signing).
 */
export async function readContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller?: string
) {
  const account =
    caller || Keypair.random().publicKey(); // Use a random keypair for read-only
  const sim = await callContract(method, params, account, false);
  if (
    rpc.Api.isSimulationSuccess(sim as rpc.Api.SimulateTransactionResponse) &&
    (sim as rpc.Api.SimulateTransactionSuccessResponse).result
  ) {
    return scValToNative(
      (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval
    );
  }
  return null;
}

// ============================================================
// ScVal Conversion Helpers
// ============================================================

export function toScValString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function toScValU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValU64(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "u64" });
}

export function toScValI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function toScValAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function toScValBool(value: boolean): xdr.ScVal {
  return nativeToScVal(value, { type: "bool" });
}

// ============================================================
// Supply Chain Tracker — Contract Methods
// ============================================================

/**
 * Add a product to the supply chain.
 * Calls: add_product(product_id: String, origin: String)
 */
export async function addProduct(
  caller: string,
  productId: string,
  origin: string
) {
  return callContract(
    "add_product",
    [toScValString(productId), toScValString(origin)],
    caller,
    true
  );
}

/**
 * Update a product's status.
 * Calls: update_status(product_id: String, new_status: String)
 */
export async function updateProductStatus(
  caller: string,
  productId: string,
  newStatus: string
) {
  return callContract(
    "update_status",
    [toScValString(productId), toScValString(newStatus)],
    caller,
    true
  );
}

/**
 * Get product details (read-only).
 * Calls: get_product(product_id: String) -> Map<Symbol, String>
 * Returns: { origin: string, status: string } or null
 */
export async function getProduct(
  productId: string,
  caller?: string
) {
  return readContract(
    "get_product",
    [toScValString(productId)],
    caller
  );
}

// ============================================================
// Decentralized Messaging — Contract Methods
// ============================================================

/**
 * Initialize the messaging contract (admin only).
 * Calls: initialize(admin: Address)
 */
export async function initialize(caller: string, admin: string) {
  return callContract(
    "initialize",
    [toScValAddress(admin)],
    caller,
    true
  );
}

/**
 * Send a message to another user.
 * Calls: send_message(sender: Address, recipient: Address, content: String) -> u64
 * Returns: message ID
 */
export async function sendMessage(
  caller: string,
  recipient: string,
  content: string
) {
  return callContract(
    "send_message",
    [
      toScValAddress(caller),
      toScValAddress(recipient),
      toScValString(content),
    ],
    caller,
    true
  );
}

/**
 * Get a single message by ID.
 * Calls: get_message(caller: Address, msg_id: u64) -> Message
 * Returns: { id, sender, recipient, content, timestamp, read }
 */
export async function getMessage(
  msgId: bigint,
  caller: string
) {
  return readContract(
    "get_message",
    [toScValAddress(caller), toScValU64(msgId)],
    caller
  );
}

/**
 * Mark a message as read.
 * Calls: mark_read(caller: Address, msg_id: u64)
 */
export async function markRead(
  caller: string,
  msgId: bigint
) {
  return callContract(
    "mark_read",
    [toScValAddress(caller), toScValU64(msgId)],
    caller,
    true
  );
}

/**
 * Get all message IDs in the user's inbox.
 * Calls: get_inbox(owner: Address) -> Vec<u64>
 * Returns: array of message IDs
 */
export async function getInbox(owner: string) {
  return readContract(
    "get_inbox",
    [toScValAddress(owner)],
    owner
  );
}

/**
 * Get all message IDs the user has sent.
 * Calls: get_sent(owner: Address) -> Vec<u64>
 * Returns: array of message IDs
 */
export async function getSent(owner: string) {
  return readContract(
    "get_sent",
    [toScValAddress(owner)],
    owner
  );
}

/**
 * Get the count of unread messages for a user.
 * Calls: unread_count(owner: Address) -> u32
 * Returns: number of unread messages
 */
export async function unreadCount(owner: string) {
  return readContract(
    "unread_count",
    [toScValAddress(owner)],
    owner
  );
}

/**
 * Get total messages ever sent (read-only).
 * Calls: total_messages() -> u64
 * Returns: total message count
 */
export async function totalMessages() {
  return readContract(
    "total_messages",
    []
  );
}

/**
 * Get the current admin address (read-only).
 * Calls: get_admin() -> Address
 * Returns: admin address
 */
export async function getAdmin() {
  return readContract(
    "get_admin",
    []
  );
}

/**
 * Transfer admin rights to a new address (admin only).
 * Calls: transfer_admin(current_admin: Address, new_admin: Address)
 */
export async function transferAdmin(
  caller: string,
  newAdmin: string
) {
  return callContract(
    "transfer_admin",
    [toScValAddress(caller), toScValAddress(newAdmin)],
    caller,
    true
  );
}

export { nativeToScVal, scValToNative, Address, xdr };
