# Walkthrough

The class in the order it runs. The spine of the day is: write a contract, publish it on
mainnet, name it on the Move Registry, call it by name. The debugger comes after, on the same
package. Commands assume the repo root.

Networks: publishing and naming happen on **mainnet** today. Testnet is used only for the
debugger's throwaway failing transaction. Set `SUI_NETWORK=mainnet` in front of a script to
pick up `.env.mainnet`; leave it off to use `.env` (testnet).

Shell note: zsh expands `[...]` as a glob. Every PTB list argument is quoted below, `'[10000000]'`,
`'[out]'`. Without the quotes you get `zsh: no matches found`.

## Part 0: the story (talk, 25 min)

Slides. No terminal. The one live moment: resolve three versions of DeepBook so the room sees
what "a name follows upgrades" means.

```bash
mvr resolve @deepbook/core --network mainnet | grep package_address
mvr resolve @deepbook/core/1 --network mainnet | grep package_address
mvr resolve @deepbook/core/2 --network mainnet | grep package_address
```

## Part 1: write the contract (20 min)

Everyone writes `greeter` from scratch. It is thirty lines and it is enough. Open
`move/greeter/sources/greeter.move` on the projector only after they have tried.

```bash
sui move new greeter && cd greeter
# write sources/greeter.move (module greeter::greeter, one struct, one entry, one event)
sui move build
sui move test          # no tests yet; the command still proves the toolchain
```

Points to make while they type: no `msg.sender`, the object is the return value, the event is
the only thing an indexer will see.

## Part 2: publish on mainnet (10 min)

```bash
sui client switch --env mainnet
sui client gas                       # need ~0.05 SUI
sui client publish --gas-budget 200000000
```

Everyone writes down three things: the package ID, the UpgradeCap ID, and, if the package
creates a shared object, its ID. Say it out loud: the UpgradeCap is the proof of ownership for
everything that follows. Do not lose it, do not burn it yet.

## Part 3: create the PackageInfo (10 min)

This is the object the registry will point at. It is made from the UpgradeCap and carries the
card the website shows: a display name, description metadata, git info.

```bash
SUI_NETWORK=mainnet node scripts/06-package-info-for.mjs <UPGRADE_CAP_ID> @weed420/<yourname> "<yourname>" greeter
```

Or, in the CLI:

```bash
sui client ptb \
  --move-call @mvr/metadata::package_info::new @<UPGRADE_CAP_ID> --assign info \
  --move-call @mvr/metadata::display::default '"<yourname>"' --assign d \
  --move-call @mvr/metadata::package_info::set_display info d \
  --move-call @mvr/metadata::package_info::set_metadata info '"default"' '"@weed420/<yourname>"' \
  --move-call @mvr/metadata::package_info::transfer info @$(sui client active-address) \
  --gas-budget 50000000
```

Everyone now owns a PackageInfo with their name on the card. Show one on suiscan.

## Part 4: name it (25 min)

Two paths, both live.

**Instructor, website.** Connect the wallet that owns `weed420.sui` at moveregistry.com/apps.
Create Package: organisation `@weed420`, name `vault2`, pick the vault card for mainnet. One
signature. This is what a team does day to day.

**Room, volunteers.** Naming needs a SuiNS name on mainnet. Most of the room does not have
one, so three or four volunteers send their PackageInfo to the instructor wallet and get a
name under `@weed420` in front of everyone:

```bash
# volunteer, from their wallet
sui client ptb --move-call @mvr/metadata::package_info::transfer @<THEIR_PACKAGE_INFO_ID> @0x98a945d6523ba0b4685c4d50d0449c811fded93ad7a20cf2d61af6a6fd4d4d0b --gas-budget 10000000
```

Then on the website: Create Package, name `<theirname>`, pick their card. Their package is now
`@weed420/<theirname>` on mainnet. Say clearly: they still own the package and the UpgradeCap;
only the metadata object moved, and the name is under the instructor's SuiNS until they get
their own.

**Script path**, for the record: `scripts/05-register-name.mjs` does register plus
`set_network` for testnet from the command line. Show the file, do not run it.

Check every name the same way:

```bash
mvr resolve @weed420/<name> --network mainnet
curl -s https://mainnet.mvr.mystenlabs.com/v1/names/@weed420/<name>
```

The API may lag the chain by a few minutes. `mvr resolve` reads the chain.

## Part 5: call it by name (25 min)

### TypeScript

`scripts/_lib.mjs` registers the plugin once. `scripts/02-call-by-name.mjs` has a name as the
target and no address anywhere.

```bash
SUI_NETWORK=mainnet node scripts/02-call-by-name.mjs        # deposits 0.01 SUI into @weed420/vault2
```

For a volunteer's greeter, the call is `@weed420/<name>::greeter::greet`; adapt the script live
or use the CLI below.

### CLI

```bash
sui client ptb \
  --move-call @weed420/<name>::greeter::greet '"hello from SuiHub"' --assign g \
  --transfer-objects '[g]' @$(sui client active-address) \
  --gas-budget 10000000
```

### Move

```bash
cd move/consumer
cat Move.toml                                  # deepbook = { r.mvr = "@deepbook/core" }, vault = { r.mvr = "@weed420/vault" }
MVR_FALLBACK_NETWORK=mainnet sui move build    # watch "resolving @deepbook/core on network: mainnet"
```

Say the gotcha: a Move dependency on a name needs the package source reachable at the git info
on its PackageInfo. Private repo or wrong path fails with "Unexpected parsing error".

### Upgrades

Nothing to run. Explain: the bare name follows upgrades automatically; `/N` pins; after an
upgrade add `set_git_versioning(info, N, git)`; register before you ever burn the cap.

## Break (10 min)

## Part 6: the trace debugger (40 min)

Same vault package, on testnet so the failing transaction costs nothing.

```bash
cd move/vault && sui move test --trace && ls traces/ && code .
```

VS Code: open the test file, Run > Start Debugging, choose
`test_withdraw_just_above_balance_aborts_in_framework`. Breakpoint on `let available = ...`.
Locals: funds, treasury, amount, available. Step into `balance::split`.

Then on-chain:

```bash
cd ../.. && pnpm break-it                      # testnet, prints the failing digest
sui replay --trace --digest <DIGEST>
cd move/vault && sui move build && cd ../..
cp -r move/vault/build/vault/* .replay/<DIGEST>/<VAULT_PACKAGE_ID>/source/
code .replay/<DIGEST>                          # open trace.json.zst, Start Debugging
```

Backup digest: `scripts/failing-digest.txt`.

## Part 7: the rest of the toolchain (10 min)

```bash
sui move fmt
sui client --client.env mainnet verify-source move/vault
sui replay --digest <ANY_DIGEST>
mvr search weed420
```

## Open lab

Fix the vault bug, upgrade on mainnet, and watch `@weed420/vault2` follow to version 2 with no
registry change. Then add `set_git_versioning(info, 2, git)`. That is the bridge to Day 3.
