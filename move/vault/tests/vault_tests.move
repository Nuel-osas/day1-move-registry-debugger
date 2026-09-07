#[test_only]
#[allow(unused_let_mut)]
module vault::vault_tests;

use std::unit_test::assert_eq;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use vault::vault::{Self, Vault, VaultAdminCap};

const ADMIN: address = @0xA;
const USER: address = @0xB;
const OTHER: address = @0xC;

fun setup(): ts::Scenario {
    let mut s = ts::begin(ADMIN);
    vault::init_for_testing(s.ctx());
    s.next_tx(ADMIN);
    s
}

#[test]
fun test_deposit_then_partial_withdraw() {
    let mut s = setup();
    s.next_tx(USER);
    let mut v = s.take_shared<Vault>();
    v.deposit(coin::mint_for_testing<SUI>(10_000, s.ctx()), s.ctx());
    assert_eq!(v.balance_of(USER), 10_000);
    let out = v.withdraw(1_000, s.ctx());
    // 50 bps of 1_000 = 5
    assert_eq!(out.value(), 995);
    assert_eq!(v.treasury(), 5);
    assert_eq!(v.balance_of(USER), 9_000);
    coin::burn_for_testing(out);
    ts::return_shared(v);
    s.end();
}

#[test]
fun test_admin_sets_fee() {
    let mut s = setup();
    let cap = s.take_from_sender<VaultAdminCap>();
    let mut v = s.take_shared<Vault>();
    v.set_fee_bps(&cap, 100);
    assert_eq!(v.fee_bps(), 100);
    assert_eq!(v.fee_for(10_000), 100);
    ts::return_shared(v);
    s.return_to_sender(cap);
    s.end();
}

#[test, expected_failure(abort_code = vault::EFeeTooHigh)]
fun test_fee_above_max_aborts() {
    let mut s = setup();
    let cap = s.take_from_sender<VaultAdminCap>();
    let mut v = s.take_shared<Vault>();
    v.set_fee_bps(&cap, 1_001);
    abort 0
}

#[test, expected_failure(abort_code = vault::EVaultFrozen)]
fun test_deposit_when_frozen_aborts() {
    let mut s = setup();
    let cap = s.take_from_sender<VaultAdminCap>();
    let mut v = s.take_shared<Vault>();
    v.freeze_vault(&cap);
    s.next_tx(USER);
    v.deposit(coin::mint_for_testing<SUI>(1, s.ctx()), s.ctx());
    abort 0
}

#[test, expected_failure(abort_code = vault::ENoDeposit)]
fun test_other_user_cannot_withdraw_my_deposit() {
    let mut s = setup();
    s.next_tx(USER);
    let mut v = s.take_shared<Vault>();
    v.deposit(coin::mint_for_testing<SUI>(10_000, s.ctx()), s.ctx());
    s.next_tx(OTHER);
    let out = v.withdraw(1, s.ctx());
    coin::burn_for_testing(out);
    abort 0
}

#[test, expected_failure(abort_code = vault::EInsufficientBalance)]
fun test_withdraw_far_above_balance_aborts_cleanly() {
    let mut s = setup();
    s.next_tx(USER);
    let mut v = s.take_shared<Vault>();
    v.deposit(coin::mint_for_testing<SUI>(1_000, s.ctx()), s.ctx());
    let out = v.withdraw(5_000, s.ctx());
    coin::burn_for_testing(out);
    abort 0
}

// The bug. After one withdrawal the treasury holds 5 and the user holds 9_000.
// Withdrawing 9_003 should abort with EInsufficientBalance (30). It aborts
// with sui::balance::ENotEnough (2) instead, from inside the framework.
// Run `sui move test --trace`, open traces/ in VS Code, and step to the line
// where `available` is computed to see why.
#[test, expected_failure(abort_code = sui::balance::ENotEnough)]
fun test_withdraw_just_above_balance_aborts_in_framework() {
    let mut s = setup();
    s.next_tx(USER);
    let mut v = s.take_shared<Vault>();
    v.deposit(coin::mint_for_testing<SUI>(10_000, s.ctx()), s.ctx());
    let first = v.withdraw(1_000, s.ctx());
    coin::burn_for_testing(first);
    assert_eq!(v.balance_of(USER), 9_000);
    assert_eq!(v.treasury(), 5);
    let second = v.withdraw(9_003, s.ctx());
    coin::burn_for_testing(second);
    abort 0
}
