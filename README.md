# Day 1: Move Registry + Trace Debugger

Companion repo for Day 1 of the SuiHub Lagos Production Week. Two tools, one package,
one real failed transaction.

The spine of the day: write a contract, publish it on mainnet, name it on the Move Registry,
call it by name. Then debug it with traces instead of prints.

| Path | What it is |
|---|---|
| `move/vault/` | The demo package. A shared SUI vault with a planted bug in `withdraw`. Six unit tests, one of which exercises the bug. |
| `move/counter/`, `move/greeter/` | Two tiny extra packages, published on mainnet, so the registry demo has several PackageInfos to choose from. |
| `move/consumer/` | A package that depends on DeepBook by MVR name (`@deepbook/core`) and, after registration, on `@weed420/vault`. |
| `scripts/01-resolve-by-name.mjs` | Resolve names over plain HTTP. Shows what the SDK plugin calls under the hood. |
| `scripts/02-call-by-name.mjs` | Deposit into the vault with a name as the call target. No address in the file. |
| `scripts/03-break-it.mjs` | Trip the bug on testnet so the failure has a digest you can replay. |
| `scripts/04-register-package-info.mjs` | Create the vault's `PackageInfo` on testnet from the UpgradeCap, with metadata and git info. |
| `scripts/06-package-info-for.mjs` | Create a PackageInfo for any package you hold the cap of, with a display name (what moveregistry.com shows), metadata, git info, and send it to a wallet. |
| `scripts/05-register-name.mjs` | Register `@weed420/vault` in the registry on mainnet and point its testnet entry at the PackageInfo. |
| `SETUP.md` | Install everything before class. |
| `WALKTHROUGH.md` | The class, step by step, in the order it runs. |
| `docs/naming-step-by-step.md` | Naming a package from zero, one command per step, with the real IDs from this repo as the worked example. Start here if registration is confusing. |
| `docs/` | Reference notes: how MVR resolves, how traces work, what to look for. |

## Live IDs (testnet)

| | |
|---|---|
| Vault package | `0x55833c3dcabee5f424961abf94ba5fe7f918033ae5228a71fd79b4e1dc38e31d` |
| Vault (shared) | `0x0cf755e633be54184794d421a61b918bcb65c16afae050ccf2a57751aa3d6570` |
| PackageInfo | `0x3a6e4f2873c4d3f75baa227fe8b62c244eb6c977751585c29bd964fcee3bf370` |
| MVR name | `@weed420/vault` |
| Failing digest | `8NCYCzV67YQr73jVXnAsw3tTgDAiVCDZku7EPH4zc2M9` |

## Live IDs (mainnet)

| | |
|---|---|
| Vault package | `0xa43af7414ff07c16d642656dd5db14b9b998bca11bb35a4473dd00adb0abd7eb` |
| Vault (shared) | `0x34b732f113bb675214d0879128aebde753746269ea3a53205aaa68468b6d0497` |
| PackageInfo | `0x5191e4e8ec777ad7f897a4c91f18a8fb1d243b4e8722de00fde98109da92768a` |

A second mainnet vault with the v2 code was published on 2026-09-07 from the SuiNS owner wallet:
package `0xeb11854fd72d724fdd5e2d3e16a245192b22a6b9218fba053df304a4bb3a87c0`, shared vault
`0x4f019b48e8e60b4ab5f5062b8fe10e44d67c3109971684ff4202c0a368b8c1cc`. `move/vault/Published.toml`
now records that one under mainnet; the original's IDs are kept in `scripts/deployed.mainnet.env`.

Both PackageInfo objects are held by the wallet that owns weed420.sui, so the mainnet binding
can be made from moveregistry.com with that wallet. PackageInfo has no `store` ability: move it
with `@mvr/metadata::package_info::transfer`, not `sui client transfer`.

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
let ledger = df::borrow_mut<address, Balance<SUI>>(&mut self.id, recipient);
let available = ledger.value() + treasury_value;          // should be ledger.value() alone
assert!(available >= amount, EInsufficientBalance);       // passes when it should not
let fee_balance = ledger.split(fee);
let out = coin::from_balance(ledger.split(payout), ctx);  // aborts in sui::balance, code 2
```

Each depositor's SUI is its own `Balance<SUI>` dynamic field on the vault, keyed by address, so
you can only withdraw what you deposited. The vault is at version 2 on both networks; v1 code
is inert after `migrate`. The names `@weed420/vault` and `@weed420/vault2` followed the upgrade
with no registry change.

You asked for error 30 from your module. You got error 2 from a module you did not write.
That is the kind of failure the debugger is for.

## Requirements

Sui CLI 1.79+ from Homebrew (tracing enabled), Node 20+, pnpm, the `mvr` CLI, and the
`mysten.move` and `mysten.move-trace-debug` VS Code extensions. See `SETUP.md`.

## Notes

- Mysten's public fullnodes no longer serve JSON-RPC. The scripts use a provider that still
  does on testnet (`SUI_RPC_URL` to override). JSON-RPC is removed entirely in mid-October 2026.
- Registering your own name needs a SuiNS name you own on mainnet. Consuming names does not.
- Depending on a name from `Move.toml` needs the package's source to be reachable at the git
  info recorded on its PackageInfo. Calling by name from TypeScript or the CLI does not.

MIT.
