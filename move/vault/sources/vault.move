// Copyright (c) SuiHub Lagos teaching materials.
// SPDX-License-Identifier: MIT

/// A shared savings vault with per-depositor balances and a flat withdrawal
/// fee, used to teach the Move Registry and the Move Trace Debugger.
///
/// Each depositor's SUI sits in its own `Balance<SUI>` stored as a dynamic
/// field on the vault, keyed by address. You can only withdraw what you
/// deposited. Only the holder of the `VaultAdminCap` may change the fee,
/// freeze the vault, or collect the treasury.
///
/// `withdraw` contains a deliberate bug that the class finds with the trace
/// debugger: the balance guard counts the treasury as withdrawable, so a
/// withdrawal slightly above your real balance passes the guard and then
/// aborts inside `sui::balance::split` with `ENotEnough` (code 2) instead
/// of this module's `EInsufficientBalance` (code 30).
///
/// ### Key Features:
///
/// - Shared `Vault`; per-depositor `Balance<SUI>` dynamic fields
/// - `VaultAdminCap` gating fee, freeze, treasury
/// - Versioned: v1 state is migrated by the admin; v1 code is then inert
///
/// ### State Machine:
///
/// Open → Frozen (admin), Frozen → Open (admin)
module vault::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::dynamic_field as df;
use sui::event::emit;
use sui::sui::SUI;

// === Structs ===

public struct Vault has key {
    id: UID,
    state: VaultState,
    /// v1 pooled deposits. Unused from v2; swept by the admin.
    funds: Balance<SUI>,
    treasury: Balance<SUI>,
    fee_bps: u64,
    version: u64,
}

public struct VaultAdminCap has key, store {
    id: UID,
    vault_id: ID,
}

// === Enums ===

public enum VaultState has copy, drop, store {
    Open,
    Frozen,
}

// === Events ===

public struct DepositedEvent has copy, drop {
    vault_id: ID,
    depositor: address,
    amount: u64,
}

public struct WithdrewEvent has copy, drop {
    vault_id: ID,
    recipient: address,
    amount: u64,
    fee: u64,
}

public struct MigratedEvent has copy, drop {
    vault_id: ID,
    from_version: u64,
    to_version: u64,
}

// === Constants ===

const VERSION: u64 = 2;
const BPS_DENOMINATOR: u64 = 10_000;
const MAX_FEE_BPS: u64 = 1_000;

// === Errors ===
// State errors (10-19)
const EVaultFrozen: u64 = 10;
const EWrongVersion: u64 = 11;
const ENotUpgrade: u64 = 12;

// Validation errors (20-29)
const EZeroAmount: u64 = 20;
const EFeeTooHigh: u64 = 21;

// Constraint errors (30-39)
const EInsufficientBalance: u64 = 30;

// Reference errors (50-59)
const EWrongVault: u64 = 50;
const ENoDeposit: u64 = 51;

fun init(ctx: &mut TxContext) {
    let vault = Vault {
        id: object::new(ctx),
        state: VaultState::Open,
        funds: balance::zero(),
        treasury: balance::zero(),
        fee_bps: 50,
        version: VERSION,
    };
    let cap = VaultAdminCap { id: object::new(ctx), vault_id: vault.id.to_inner() };
    transfer::share_object(vault);
    transfer::transfer(cap, ctx.sender());
}

// === Public Functions ===

public fun deposit(self: &mut Vault, coin: Coin<SUI>, ctx: &TxContext) {
    self.assert_version();
    assert!(self.is_open_state(), EVaultFrozen);
    let amount = coin.value();
    assert!(amount > 0, EZeroAmount);
    let depositor = ctx.sender();
    if (!df::exists(&self.id, depositor)) {
        df::add(&mut self.id, depositor, balance::zero<SUI>());
    };
    df::borrow_mut<address, Balance<SUI>>(&mut self.id, depositor).join(coin.into_balance());
    emit(DepositedEvent { vault_id: self.id.to_inner(), depositor, amount });
}

public fun withdraw(self: &mut Vault, amount: u64, ctx: &mut TxContext): Coin<SUI> {
    self.assert_version();
    assert!(self.is_open_state(), EVaultFrozen);
    assert!(amount > 0, EZeroAmount);
    let recipient = ctx.sender();
    assert!(df::exists(&self.id, recipient), ENoDeposit);
    let fee = self.fee_for(amount);
    let payout = amount - fee;
    let vault_id = self.id.to_inner();
    let treasury_value = self.treasury.value();
    let ledger = df::borrow_mut<address, Balance<SUI>>(&mut self.id, recipient);
    // BUG (deliberate): `available` should be `ledger.value()` alone.
    // Counting the treasury lets a withdrawal pass this guard and then abort
    // inside sui::balance::split with ENotEnough. Day 1 finds this with the
    // trace debugger; Day 3 ships the fix as the next version.
    let available = ledger.value() + treasury_value;
    assert!(available >= amount, EInsufficientBalance);
    let fee_balance = ledger.split(fee);
    let out = coin::from_balance(ledger.split(payout), ctx);
    self.treasury.join(fee_balance);
    emit(WithdrewEvent { vault_id, recipient, amount: payout, fee });
    out
}

public fun set_fee_bps(self: &mut Vault, cap: &VaultAdminCap, fee_bps: u64) {
    self.assert_version();
    self.assert_cap(cap);
    assert!(fee_bps <= MAX_FEE_BPS, EFeeTooHigh);
    self.fee_bps = fee_bps;
}

public fun freeze_vault(self: &mut Vault, cap: &VaultAdminCap) {
    self.assert_version();
    self.assert_cap(cap);
    self.state = VaultState::Frozen;
}

public fun unfreeze_vault(self: &mut Vault, cap: &VaultAdminCap) {
    self.assert_version();
    self.assert_cap(cap);
    self.state = VaultState::Open;
}

public fun collect_treasury(self: &mut Vault, cap: &VaultAdminCap, ctx: &mut TxContext): Coin<SUI> {
    self.assert_version();
    self.assert_cap(cap);
    let all = self.treasury.value();
    coin::from_balance(self.treasury.split(all), ctx)
}

/// Sweep the v1 pooled deposits. Only the admin; only the small amounts the
/// instructor deposited before v2.
public fun collect_legacy_funds(self: &mut Vault, cap: &VaultAdminCap, ctx: &mut TxContext): Coin<SUI> {
    self.assert_version();
    self.assert_cap(cap);
    let all = self.funds.value();
    coin::from_balance(self.funds.split(all), ctx)
}

/// Move a v1 vault to v2. After this, v1 code aborts with EWrongVersion.
public fun migrate(self: &mut Vault, cap: &VaultAdminCap) {
    self.assert_cap(cap);
    assert!(self.version < VERSION, ENotUpgrade);
    let from = self.version;
    self.version = VERSION;
    emit(MigratedEvent { vault_id: self.id.to_inner(), from_version: from, to_version: VERSION });
}

// === View Functions ===

public fun balance_of(self: &Vault, depositor: address): u64 {
    if (!df::exists(&self.id, depositor)) return 0;
    df::borrow<address, Balance<SUI>>(&self.id, depositor).value()
}

public fun funds(self: &Vault): u64 { self.funds.value() }

public fun treasury(self: &Vault): u64 { self.treasury.value() }

public fun fee_bps(self: &Vault): u64 { self.fee_bps }

public fun version(self: &Vault): u64 { self.version }

public fun fee_for(self: &Vault, amount: u64): u64 {
    amount * self.fee_bps / BPS_DENOMINATOR
}

public fun is_open_state(self: &Vault): bool {
    match (&self.state) {
        VaultState::Open => true,
        _ => false,
    }
}

fun assert_version(self: &Vault) {
    assert!(self.version == VERSION, EWrongVersion);
}

fun assert_cap(self: &Vault, cap: &VaultAdminCap) {
    assert!(cap.vault_id == self.id.to_inner(), EWrongVault);
}

// === Test Only ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
