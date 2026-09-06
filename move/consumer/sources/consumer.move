// Copyright (c) SuiHub Lagos teaching materials.
// SPDX-License-Identifier: MIT

/// A package that depends on DeepBook by MVR name rather than by address.
/// Exists to show `mvr add` and name resolution during `sui move build`.
module consumer::consumer;

use deepbook::pool::Pool;

// === View Functions ===

/// Read the whitelist flag of any DeepBook pool. The `deepbook` address was
/// resolved from `@deepbook/core` at build time.
public fun pool_is_whitelisted<Base, Quote>(pool: &Pool<Base, Quote>): bool {
    pool.whitelisted()
}

// === Vault by name ===

use vault::vault::Vault;

/// Read the vault's fee. `vault` was resolved from `@weed420/vault` at build time.
public fun vault_fee_bps(v: &Vault): u64 { v.fee_bps() }
