// Copyright (c) SuiHub Lagos teaching materials.
// SPDX-License-Identifier: MIT

/// A shared counter. Exists to give the Move Registry a second package to name.
///
/// ### Key Features:
///
/// - One shared `Counter` created at publish
/// - Anyone may increment; the owner cap may reset
module counter::counter;

use sui::event::emit;

// === Structs ===

public struct Counter has key {
    id: UID,
    value: u64,
}

public struct CounterAdminCap has key, store {
    id: UID,
}

// === Events ===

public struct IncrementedEvent has copy, drop {
    counter_id: ID,
    value: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Counter { id: object::new(ctx), value: 0 });
    transfer::transfer(CounterAdminCap { id: object::new(ctx) }, ctx.sender());
}

// === Public Functions ===

public fun increment(self: &mut Counter) {
    self.value = self.value + 1;
    emit(IncrementedEvent { counter_id: self.id.to_inner(), value: self.value });
}

public fun reset(self: &mut Counter, _: &CounterAdminCap) {
    self.value = 0;
}

// === View Functions ===

public fun value(self: &Counter): u64 { self.value }
