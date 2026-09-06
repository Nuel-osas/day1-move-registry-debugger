# Walkthrough

The class in the order it runs. Commands assume you are in the repo root with `.env` in place.

## Part 1: what a name is (talk, 20 min)

Slides. Then one live command so the room sees it is real:

```bash
mvr resolve @deepbook/core --network testnet
curl -s https://testnet.mvr.mystenlabs.com/v1/names/@deepbook/core | head -c 400
```

Point out: metadata comes from the mainnet registry; `package_address` is the testnet pointer.

## Part 2: consume by name (30 min)

### 2a. Over HTTP, no SDK

```bash
pnpm resolve
```

### 2b. In Move.toml

```bash
cd move/consumer
cat Move.toml                   # deepbook = { r.mvr = "@deepbook/core" }
sui move build                  # watch "Output from mvr: resolving @deepbook/core on testnet"
cd ../..
```

Show `mvr add @deepbook/core` on an empty package if there is time. `MVR_FALLBACK_NETWORK=testnet`
if the CLI cannot detect the network.

### 2c. In TypeScript

Open `scripts/_lib.mjs`. The plugin is registered once, globally. Open `scripts/02-call-by-name.mjs`.
The target is `@weed420/vault::vault::deposit`. No address anywhere.

```bash
pnpm call-by-name
```

### 2d. From the CLI

```bash
sui client ptb \
  --move-call @mvr/metadata::package_info::new @<UPGRADE_CAP_ID> --assign info \
  --move-call @mvr/metadata::package_info::transfer info @<YOUR_ADDRESS> \
  --dry-run
```

## Part 3: name your own package (30 min)

Everyone publishes the vault to testnet under their own address and creates a PackageInfo.
Only people with a mainnet SuiNS name do the last step; the instructor does it live.

```bash
cd move/vault && sui client publish --gas-budget 100000000 && cd ../..
# copy PACKAGE, the shared Vault, the UpgradeCap into .env
pnpm register                                   # 04: PackageInfo on testnet
# instructor only, mainnet, signed by the SuiNS owner:
SUI_NETWORK=mainnet SUI_SIGNER_ADDRESS=<owner> node scripts/05-register-name.mjs
SUI_NETWORK=mainnet SUI_SIGNER_ADDRESS=<owner> node scripts/05-register-name.mjs --execute
mvr resolve @weed420/vault --network testnet
```

Then in `move/consumer/Move.toml` add `vault = { r.mvr = "@weed420/vault" }` and build.

Gotcha worth saying out loud: for a Move dependency, the `mvr` binary fetches the package
source from the git info on the PackageInfo (repository, path, tag). If that repo is private or
the path is wrong, `sui move build` fails with an unhelpful "Unexpected parsing error". Calling
by name from TypeScript or the CLI does not need the source; only Move dependencies do.

## Part 4: the trace debugger (60 min)

### 4a. Unit test trace

```bash
cd move/vault
sui move test --trace
ls traces/
code .
```

In VS Code: open `tests/vault_tests.move`, Run > Start Debugging, choose
`test_withdraw_just_above_balance_aborts_in_framework`. Set a breakpoint on the line
`let available = ...` in `sources/vault.move`. Continue. Read the locals: `funds`, `treasury`,
`amount`, `available`. Step over twice and watch the abort come from `sui::balance::split`.

### 4b. On-chain trace

```bash
cd ../..
pnpm break-it                                   # prints the failing digest
sui replay --trace --digest <DIGEST>
ls .replay/<DIGEST>                             # trace.json.zst, transaction_data.json, one dir per package
```

Give the debugger the source. It must match the published bytecode, so build the same commit:

```bash
cd move/vault && sui move build && cd ../..
cp -r move/vault/build/vault/* .replay/<DIGEST>/<VAULT_PACKAGE_ID>/source/
code .replay/<DIGEST>
```

Open `trace.json.zst`, Run > Start Debugging. The PTB view shows command 0 failed. Step into
`withdraw`, then into `split`. Same locals, same story, but this time it ran on the network.

A prepared digest is in `scripts/failing-digest.txt` if the live run misbehaves.

## Part 5: the rest of the toolchain (20 min)

```bash
sui move fmt                                    # or format-on-save in VS Code
sui client verify-source move/vault             # after publish: proves source == bytecode
sui replay --digest <ANY_DIGEST>                # effects and gas without a trace
mvr search vault
```

## Open lab

Fix the bug in `withdraw` (use `self.funds.value()` alone), rerun the tests, re-publish, and
watch `@weed420/vault` keep working for anyone calling by name once the pointer is updated.
That last part is Day 3.
