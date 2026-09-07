// Copyright (c) SuiHub Lagos teaching materials.
// SPDX-License-Identifier: MIT

/// Mints a `Greeting` object carrying a message. Exists to give the Move
/// Registry a third package to name.
///
/// ### Key Features:
///
/// - Owned `Greeting` objects, one per call
/// - Message length bounded
module greeter::greeter;

use std::string::String;
use sui::event::emit;

// === Structs ===

public struct Greeting has key, store {
    id: UID,
    message: String,
}

// === Events ===

public struct GreetedEvent has copy, drop {
    greeting_id: ID,
    recipient: address,
    message: String,
}

// === Constants ===

const MAX_MESSAGE_LEN: u64 = 140;

// === Errors ===
// Validation errors (20-29)
const EMessageTooLong: u64 = 20;

// === Public Functions ===

public fun greet(message: String, ctx: &mut TxContext): Greeting {
    assert!(message.length() <= MAX_MESSAGE_LEN, EMessageTooLong);
    let greeting = Greeting { id: object::new(ctx), message };
    emit(GreetedEvent { greeting_id: greeting.id.to_inner(), recipient: ctx.sender(), message });
    greeting
}

// === View Functions ===

public fun message(self: &Greeting): &String { &self.message }
