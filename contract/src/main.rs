//! x402 Settlement Contract for Casper Network
//!
//! This contract settles x402 HTTP payments on-chain.
//! Each payment emits a settlement record that anyone can query.
//!
//! Flow:
//!   1. Facilitator calls `settle(payment_ref, payer, amount, deploy_hash)`
//!   2. Contract stores the settlement record (idempotent)
//!   3. Anyone can query `get_settlement(payment_ref)` to verify a payment
//!
//! Built for Casper Agentic Buildathon 2026 ($150K).

#![no_std]
#![no_main]

extern crate alloc;

use alloc::{
    format,
    string::{String, ToString},
    vec,
    vec::Vec,
};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash,
    bytesrepr::{Error, FromBytes, ToBytes},
    CLType, CLTyped, CLValue, EntryPoint, EntryPointAccess, EntryPointType, EntryPoints, Key,
    Parameter, URef, U512,
};

const PAYMENT_REGISTRY_UREF: &str = "payment_registry";
const SETTLEMENT_COUNT: &str = "settlement_count";

// ============ STORAGE HELPERS ============

fn get_registry_uref() -> URef {
    let key = runtime::get_key(PAYMENT_REGISTRY_UREF)
        .unwrap_or_revert_with(ContractError::RegistryNotInitialized as u32);
    match key {
        Key::URef(uref) => uref,
        _ => runtime::revert(ContractError::InvalidRegistryKey as u32),
    }
}

fn get_settlement_count() -> u64 {
    match runtime::get_key(SETTLEMENT_COUNT) {
        Some(Key::URef(uref)) => storage::read::<u64>(uref)
            .unwrap_or_revert()
            .unwrap_or_revert(),
        _ => 0,
    }
}

fn increment_settlement_count() {
    let count = get_settlement_count() + 1;
    match runtime::get_key(SETTLEMENT_COUNT) {
        Some(Key::URef(uref)) => storage::write(uref, count),
        _ => {
            let new_uref = storage::new_uref(count);
            runtime::put_key(SETTLEMENT_COUNT, new_uref.into());
        }
    }
}

// ============ SETTLEMENT RECORD ============

/// On-chain record of a settled x402 payment.
#[derive(Clone)]
struct SettlementRecord {
    payment_reference: String,
    payer: AccountHash,
    payee: AccountHash,
    amount: U512,
    timestamp: u64,
    settlement_id: u64,
    deploy_hash: String,
}

// Manual serialization (casper-types 4.x doesn't ship derive macros).
impl ToBytes for SettlementRecord {
    fn to_bytes(&self) -> Result<Vec<u8>, Error> {
        let mut result = Vec::new();
        result.extend_from_slice(&self.payment_reference.to_bytes()?);
        result.extend_from_slice(&self.payer.to_bytes()?);
        result.extend_from_slice(&self.payee.to_bytes()?);
        result.extend_from_slice(&self.amount.to_bytes()?);
        result.extend_from_slice(&self.timestamp.to_bytes()?);
        result.extend_from_slice(&self.settlement_id.to_bytes()?);
        result.extend_from_slice(&self.deploy_hash.to_bytes()?);
        Ok(result)
    }
    fn serialized_length(&self) -> usize {
        self.payment_reference.serialized_length()
            + self.payer.serialized_length()
            + self.payee.serialized_length()
            + self.amount.serialized_length()
            + self.timestamp.serialized_length()
            + self.settlement_id.serialized_length()
            + self.deploy_hash.serialized_length()
    }
}

impl FromBytes for SettlementRecord {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), Error> {
        let (payment_reference, rem) = String::from_bytes(bytes)?;
        let (payer, rem) = AccountHash::from_bytes(rem)?;
        let (payee, rem) = AccountHash::from_bytes(rem)?;
        let (amount, rem) = U512::from_bytes(rem)?;
        let (timestamp, rem) = u64::from_bytes(rem)?;
        let (settlement_id, rem) = u64::from_bytes(rem)?;
        let (deploy_hash, rem) = String::from_bytes(rem)?;
        Ok((
            SettlementRecord {
                payment_reference,
                payer,
                payee,
                amount,
                timestamp,
                settlement_id,
                deploy_hash,
            },
            rem,
        ))
    }
}

impl CLTyped for SettlementRecord {
    fn cl_type() -> CLType {
        CLType::Any
    }
}

// ============ ENTRY POINTS ============

/// Initialize the contract — creates the payment registry.
#[no_mangle]
pub extern "C" fn init() {
    let registry: URef = storage::new_dictionary(PAYMENT_REGISTRY_UREF)
        .unwrap_or_revert_with(ContractError::FailedToCreateRegistry as u32);
    runtime::put_key(PAYMENT_REGISTRY_UREF, registry.into());

    let count_uref = storage::new_uref(0u64);
    runtime::put_key(SETTLEMENT_COUNT, count_uref.into());
}

/// Settle a payment — the main entry point called by the facilitator.
/// Idempotent: if already settled, returns silently.
#[no_mangle]
pub extern "C" fn settle() {
    let payment_reference: String = runtime::get_named_arg("payment_reference");
    let payer: AccountHash = runtime::get_named_arg("payer");
    let amount: U512 = runtime::get_named_arg("amount");
    let deploy_hash: String = runtime::get_named_arg("deploy_hash");

    let payee = runtime::get_caller();
    let registry = get_registry_uref();

    // Idempotency check — don't double-settle
    let existing: Option<SettlementRecord> =
        storage::dictionary_get(registry, &payment_reference).unwrap_or_revert();
    if existing.is_some() {
        runtime::ret(CLValue::from_t(existing.unwrap().settlement_id).unwrap_or_revert());
    }

    let settlement_id = get_settlement_count() + 1;
    let record = SettlementRecord {
        payment_reference: payment_reference.clone(),
        payer,
        payee,
        amount,
        timestamp: u64::from(runtime::get_blocktime()),
        settlement_id,
        deploy_hash,
    };

    storage::dictionary_put(registry, &payment_reference, record);
    increment_settlement_count();

    runtime::ret(CLValue::from_t(settlement_id).unwrap_or_revert());
}

/// Query a settlement by payment reference.
#[no_mangle]
pub extern "C" fn get_settlement() {
    let payment_reference: String = runtime::get_named_arg("payment_reference");
    let registry = get_registry_uref();

    let record: Option<SettlementRecord> =
        storage::dictionary_get(registry, &payment_reference).unwrap_or_revert();

    match record {
        Some(r) => runtime::ret(CLValue::from_t(r).unwrap_or_revert()),
        None => runtime::revert(ContractError::SettlementNotFound as u32),
    }
}

/// Get total number of settlements processed.
#[no_mangle]
pub extern "C" fn get_count() {
    let count = get_settlement_count();
    runtime::ret(CLValue::from_t(count).unwrap_or_revert());
}

// ============ ERROR CODES ============

#[repr(u32)]
enum ContractError {
    RegistryNotInitialized = 1,
    InvalidRegistryKey = 2,
    FailedToCreateRegistry = 3,
    SettlementNotFound = 4,
    InvalidAmount = 5,
    InvalidSignature = 6,
    AlreadySettled = 7,
}

// ============ CONTRACT DEPLOYMENT ============

/// Build + deploy the contract.
#[no_mangle]
pub extern "C" fn call() {
    let mut entry_points = EntryPoints::new();

    // init
    entry_points.add_entry_point(EntryPoint::new(
        String::from("init"),
        Vec::new(),
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // settle
    let settle_args = vec![
        Parameter::new(String::from("payment_reference"), CLType::String),
        Parameter::new(String::from("payer"), AccountHash::cl_type()),
        Parameter::new(String::from("amount"), CLType::U512),
        Parameter::new(String::from("deploy_hash"), CLType::String),
    ];
    entry_points.add_entry_point(EntryPoint::new(
        String::from("settle"),
        settle_args,
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // get_settlement
    let get_args = vec![Parameter::new(String::from("payment_reference"), CLType::String)];
    entry_points.add_entry_point(EntryPoint::new(
        String::from("get_settlement"),
        get_args,
        CLType::Any,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // get_count
    entry_points.add_entry_point(EntryPoint::new(
        String::from("get_count"),
        Vec::new(),
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Deploy + init
    let (contract_hash, _version) =
        storage::new_contract(entry_points, None, Some("x402_settlement".to_string()), None);

    let _ = contract_hash;
}
