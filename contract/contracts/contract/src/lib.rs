#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String, Vec, Map,
    symbol_short, log,
};

// ─────────────────────────────────────────────
// Data Structures
// ─────────────────────────────────────────────

/// A single on-chain message
#[contracttype]
#[derive(Clone, Debug)]
pub struct Message {
    pub id:        u64,
    pub sender:    Address,
    pub recipient: Address,
    pub content:   String,
    pub timestamp: u64,
    pub read:      bool,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    /// Global message counter
    MsgCount,
    /// Message by ID  →  Message
    Msg(u64),
    /// Inbox list for an address  →  Vec<u64>
    Inbox(Address),
    /// Sent  list for an address  →  Vec<u64>
    Sent(Address),
    /// Admin of the contract
    Admin,
}

// ─────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────

#[contract]
pub struct DecentralizedMessaging;

#[contractimpl]
impl DecentralizedMessaging {

    // ── Initialisation ──────────────────────

    /// Initialise the contract and set the admin.
    /// Can only be called once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MsgCount, &0u64);
        log!(&env, "DecentralizedMessaging initialised by {}", admin);
    }

    // ── Core Messaging ──────────────────────

    /// Send a message to `recipient`.
    /// Returns the new message ID.
    pub fn send_message(
        env:       Env,
        sender:    Address,
        recipient: Address,
        content:   String,
    ) -> u64 {
        sender.require_auth();

        // Guard: cannot message yourself
        if sender == recipient {
            panic!("cannot send a message to yourself");
        }

        // Guard: content must not be empty
        if content.len() == 0 {
            panic!("message content cannot be empty");
        }

        // Guard: content length ≤ 500 characters
        if content.len() > 500 {
            panic!("message exceeds 500 character limit");
        }

        // Bump global counter
        let msg_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MsgCount)
            .unwrap_or(0)
            + 1;

        env.storage().instance().set(&DataKey::MsgCount, &msg_id);

        // Build message
        let msg = Message {
            id:        msg_id,
            sender:    sender.clone(),
            recipient: recipient.clone(),
            content,
            timestamp: env.ledger().timestamp(),
            read:      false,
        };

        // Persist message
        env.storage().persistent().set(&DataKey::Msg(msg_id), &msg);

        // Append to sender's outbox
        let mut sent: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::Sent(sender.clone()))
            .unwrap_or(Vec::new(&env));
        sent.push_back(msg_id);
        env.storage().persistent().set(&DataKey::Sent(sender), &sent);

        // Append to recipient's inbox
        let mut inbox: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::Inbox(recipient.clone()))
            .unwrap_or(Vec::new(&env));
        inbox.push_back(msg_id);
        env.storage()
            .persistent()
            .set(&DataKey::Inbox(recipient), &inbox);

        log!(&env, "Message {} sent", msg_id);
        msg_id
    }

    // ── Read & Mark-Read ────────────────────

    /// Fetch a single message by ID.
    /// Only the sender or recipient may read it.
    pub fn get_message(env: Env, caller: Address, msg_id: u64) -> Message {
        caller.require_auth();

        let msg: Message = env
            .storage()
            .persistent()
            .get(&DataKey::Msg(msg_id))
            .expect("message not found");

        if caller != msg.sender && caller != msg.recipient {
            panic!("unauthorised: not sender or recipient");
        }

        msg
    }

    /// Mark a message as read.
    /// Only the recipient may mark it.
    pub fn mark_read(env: Env, caller: Address, msg_id: u64) {
        caller.require_auth();

        let mut msg: Message = env
            .storage()
            .persistent()
            .get(&DataKey::Msg(msg_id))
            .expect("message not found");

        if caller != msg.recipient {
            panic!("only the recipient can mark a message as read");
        }

        msg.read = true;
        env.storage().persistent().set(&DataKey::Msg(msg_id), &msg);
    }

    // ── Inbox / Sent queries ─────────────────

    /// Return all message IDs in `owner`'s inbox.
    pub fn get_inbox(env: Env, owner: Address) -> Vec<u64> {
        owner.require_auth();
        env.storage()
            .persistent()
            .get(&DataKey::Inbox(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Return all message IDs in `owner`'s sent box.
    pub fn get_sent(env: Env, owner: Address) -> Vec<u64> {
        owner.require_auth();
        env.storage()
            .persistent()
            .get(&DataKey::Sent(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Return the count of unread messages for `owner`.
    pub fn unread_count(env: Env, owner: Address) -> u32 {
        owner.require_auth();

        let inbox: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::Inbox(owner))
            .unwrap_or(Vec::new(&env));

        let mut count: u32 = 0;
        for id in inbox.iter() {
            if let Some(msg) = env
                .storage()
                .persistent()
                .get::<DataKey, Message>(&DataKey::Msg(id))
            {
                if !msg.read {
                    count += 1;
                }
            }
        }
        count
    }

    // ── Admin ────────────────────────────────

    /// Return the total number of messages ever sent.
    pub fn total_messages(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MsgCount)
            .unwrap_or(0)
    }

    /// Return the current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialised")
    }

    /// Transfer admin rights to a new address.
    pub fn transfer_admin(env: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialised");

        if current_admin != stored_admin {
            panic!("caller is not the admin");
        }

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        log!(&env, "Admin transferred to {}", new_admin);
    }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, DecentralizedMessagingClient<'static>, Address, Address, Address) {
        let env   = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, DecentralizedMessaging);
        let client      = DecentralizedMessagingClient::new(&env, &contract_id);

        let admin     = Address::generate(&env);
        let alice     = Address::generate(&env);
        let bob       = Address::generate(&env);

        client.initialize(&admin);
        (env, client, admin, alice, bob)
    }

    #[test]
    fn test_send_and_receive() {
        let (env, client, _admin, alice, bob) = setup();

        let content = soroban_sdk::String::from_str(&env, "Hello Bob!");
        let msg_id  = client.send_message(&alice, &bob, &content);

        assert_eq!(msg_id, 1);
        assert_eq!(client.total_messages(), 1);

        let msg = client.get_message(&bob, &msg_id);
        assert_eq!(msg.sender,    alice);
        assert_eq!(msg.recipient, bob);
        assert!(!msg.read);
    }

    #[test]
    fn test_mark_read() {
        let (env, client, _admin, alice, bob) = setup();
        let content = soroban_sdk::String::from_str(&env, "Hey!");
        let msg_id  = client.send_message(&alice, &bob, &content);

        assert_eq!(client.unread_count(&bob), 1);
        client.mark_read(&bob, &msg_id);
        assert_eq!(client.unread_count(&bob), 0);

        let msg = client.get_message(&bob, &msg_id);
        assert!(msg.read);
    }

    #[test]
    fn test_inbox_and_sent() {
        let (env, client, _admin, alice, bob) = setup();

        let c1 = soroban_sdk::String::from_str(&env, "Msg 1");
        let c2 = soroban_sdk::String::from_str(&env, "Msg 2");
        client.send_message(&alice, &bob, &c1);
        client.send_message(&alice, &bob, &c2);

        assert_eq!(client.get_inbox(&bob).len(),  2);
        assert_eq!(client.get_sent(&alice).len(), 2);
    }

    #[test]
    #[should_panic(expected = "cannot send a message to yourself")]
    fn test_self_message_blocked() {
        let (env, client, _admin, alice, _bob) = setup();
        let c = soroban_sdk::String::from_str(&env, "Hi me");
        client.send_message(&alice, &alice, &c);
    }

    #[test]
    #[should_panic(expected = "message content cannot be empty")]
    fn test_empty_content_blocked() {
        let (env, client, _admin, alice, bob) = setup();
        let c = soroban_sdk::String::from_str(&env, "");
        client.send_message(&alice, &bob, &c);
    }

    #[test]
    fn test_admin_transfer() {
        let (env, client, admin, alice, _bob) = setup();
        client.transfer_admin(&admin, &alice);
        assert_eq!(client.get_admin(), alice);
    }
}