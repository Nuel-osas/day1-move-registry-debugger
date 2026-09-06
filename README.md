# Day 1: Move Registry + Trace Debugger

Companion repo for Day 1 of the SuiHub Lagos Production Week. Two tools, one package,
one real failed transaction.

The one idea of the day: a package should be known by a name, not an address, and a
bug should be found by stepping through the execution, not by printing.

| Path | What it is |
|---|---|
| `move/vault/` | The demo package. A shared SUI vault with a planted bug in `withdraw`. Six unit tests, one of which exercises the bug. |
| `move/consumer/` | A package that depends on DeepBook by MVR name (`@deepbook/core`) and, after registration, on `@weed420/vault`. |
| `scripts/01-resolve-by-name.mjs` | Resolve names over plain HTTP. Shows what the SDK plugin calls under the hood. |
| `scripts/02-call-by-name.mjs` | Deposit into the vault with a name as the call target. No address in the file. |
| `scripts/03-break-it.mjs` | Trip the bug on testnet so the failure has a digest you can replay. |
| `scripts/04-register-package-info.mjs` | Create the vault's `PackageInfo` on testnet from the UpgradeCap, with metadata and git info. |
| `scripts/05-register-name.mjs` | Register `@weed420/vault` in the registry on mainnet and point its testnet entry at the PackageInfo. |
| `SETUP.md` | Install everything before class. |
| `WALKTHROUGH.md` | The class, step by step, in the order it runs. |
| `docs/` | Reference notes: how MVR resolves, how traces work, what to look for. |

## Live IDs (testnet)

| | |
|---|---|
| Vault package | `0x55833c3dcabee5f424961abf94ba5fe7f918033ae5228a71fd79b4e1dc38e31d` |
| Vault (shared) | `0x0cf755e633be54184794d421a61b918bcb65c16afae050ccf2a57751aa3d6570` |
| PackageInfo | `0x3a6e4f2873c4d3f75baa227fe8b62c244eb6c977751585c29bd964fcee3bf370` |
| MVR name | `@weed420/vault` |
| Failing digest | `8NCYCzV67YQr73jVXnAsw3tTgDAiVCDZku7EPH4zc2M9` |

## Quick start

```bash
pnpm install
cp .env.example .env            # or use scripts/deployed.testnet.env
pnpm resolve                    # names -> addresses, no wallet needed
pnpm call-by-name               # deposit by name (testnet, needs a funded key)
pnpm break-it                   # produce a failing digest
sui replay --trace --digest <DIGEST>
```

Then open `.replay/<DIGEST>` in VS Code and start debugging. Full steps in `WALKTHROUGH.md`.

## The bug

```move
let available = self.funds.value() + self.treasury.value();   // should be funds only
assert!(available >= amount, EInsufficientBalance);           // passes when it should not
self.treasury.join(self.funds.split(fee));
let out = coin::from_balance(self.funds.split(payout), ctx);  // aborts in sui::balance, code 2
```

You asked for error 30 from your module. You got error 2 from a module you did not write.
That is the kind of failure the debugger is for.

## Requirements

Sui CLI 1.79+ from Homebrew (tracing enabled), Node 20+, pnpm, the `mvr` CLI, and the
`mysten.move` and `mysten.move-trace-debug` VS Code extensions. See `SETUP.md`.

## Notes

- Mysten's public fullnodes no longer serve JSON-RPC. The scripts use a provider that still
  does on testnet (`SUI_RPC_URL` to override). JSON-RPC is removed entirely in mid-October 2026.
- Registering your own name needs a SuiNS name you own on mainnet. Consuming names does not.

MIT.
