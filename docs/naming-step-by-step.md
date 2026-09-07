# Naming a package on MVR, one step at a time

This is the whole thing, in order, with nothing skipped. Each step is one command and one
thing to write down. The worked example uses the real objects from this repo, so you can
compare your output to it.

There are three objects you create, in this order:

```
UpgradeCap  (you already have it from publishing)
    |
    v
PackageInfo  (testnet, made from the UpgradeCap)          <- step 3
    |
    v
AppCap       (mainnet, made from your SuiNS name)          <- step 6
             and a pointer from the name to the PackageInfo
```

Two networks are involved. Steps 1 to 4 are on testnet. Steps 5 to 7 are on mainnet.

---

## Before you start: what you need

| Need | How to check | Example |
|---|---|---|
| Sui CLI 1.79+ | `sui --version` | `sui 1.79.0-homebrew` |
| mvr CLI | `mvr --version` | `mvr 0.1.0` |
| A testnet wallet with gas | `sui client gas` on testnet | 24.9 SUI |
| A SuiNS name you own, on mainnet, not expired | suins.io, or the query in step 5 | `weed420.sui` |
| The wallet that owns that SuiNS name, in your keystore, with a little mainnet SUI | `sui keytool list` | `crazy-prase`, 1.73 SUI |

If the SuiNS name is expired you have 30 days to renew it at suins.io. If you do not own one,
you can still do steps 1 to 4; only steps 5 to 7 need it.

Set this once in your shell so the mvr CLI knows the network:

```bash
export MVR_FALLBACK_NETWORK=testnet
```

---

## Step 1: publish the package (testnet)

```bash
sui client switch --env testnet
cd move/vault
sui client publish --gas-budget 100000000
```

Write down three things from the output:

| From the output | Write it down as | Example |
|---|---|---|
| the line `PackageID:` under Published Objects | `VAULT_PACKAGE_ID` | `0x55833c3dcabee5f424961abf94ba5fe7f918033ae5228a71fd91e1dc38e31d` |
| the created object of type `0x2::package::UpgradeCap` | `UPGRADE_CAP_ID` | `0x229c12e5d92cd9b886cdaf770671778763d7a0c07b1db1c4a1c5b70219a8144d` |
| the created object of type `...::vault::Vault` (Shared) | `VAULT_OBJECT_ID` | `0x0cf755e633be54184794d421a61b918bcb65c16afae050ccf2a57751aa3d6570` |

Already published? Skip this step and use the IDs you have.

## Step 2: put the IDs in .env

```bash
cd ../..            # back to the repo root
cp .env.example .env
```

Open `.env` and fill in:

```
SUI_NETWORK=testnet
MVR_NAME=@weed420/vault        # <- your SuiNS name, slash, any label you like
VAULT_PACKAGE_ID=0x5583...
VAULT_OBJECT_ID=0x0cf7...
UPGRADE_CAP_ID=0x229c...
```

The label after the slash is yours to choose. `vault`, `core`, `v1`, anything. It does not have
to match the Move package name.

## Step 3: create the PackageInfo (testnet)

This is the object that says "this package exists and here is its metadata". It is made from the
UpgradeCap, which proves you own the package.

```bash
pnpm register
```

That runs `scripts/04-register-package-info.mjs`. It does four things in one transaction:

1. `package_info::new(UpgradeCap)` creates the PackageInfo
2. `set_metadata("default", "@weed420/vault")` writes the name you intend to use
3. `git::new(repo, "move/vault", "main")` plus `set_git_versioning(info, 1, git)` records where version 1's source lives
4. transfers the PackageInfo to you

Expected output:

```
status: success
created: ...::package_info::PackageInfo 0x3a6e4f2873c4d3f75baa227fe8b62c244eb6c977751585c29bd964fcee3bf370
```

Write down the PackageInfo ID:

```
TESTNET_PACKAGE_INFO_ID=0x3a6e...
```

Add that line to `.env`.

If you prefer the CLI, the same transaction is:

```bash
sui client ptb \
  --move-call @mvr/metadata::package_info::new @$UPGRADE_CAP_ID --assign info \
  --move-call @mvr/metadata::package_info::set_metadata info '"default"' '"@weed420/vault"' \
  --move-call @mvr/metadata::git::new '"https://github.com/Nuel-osas/day1-move-registry-debugger"' '"move/vault"' '"main"' --assign git \
  --move-call @mvr/metadata::package_info::set_git_versioning info 1 git \
  --move-call @mvr/metadata::package_info::transfer info @$(sui client active-address) \
  --gas-budget 50000000
```

## Step 4: stop here if you have no mainnet SuiNS name

You now have a PackageInfo on testnet. Anyone can already call your package by address, and
your PackageInfo carries metadata and git info. The name itself needs steps 5 to 7.

---

## Step 5: find your SuiNS NFT object and its owner (mainnet)

The registration transaction needs the SuiNS registration NFT as an argument, and it must be
signed by the wallet that holds it.

List your local wallets:

```bash
sui keytool list
```

For each address, ask mainnet which SuiNS NFTs it holds:

```bash
ADDR=0x98a945d6523ba0b4685c4d50d0449c811fded93ad7a20cf2d61af6a6fd4d4d0b   # try each of yours
curl -s -X POST https://graphql.mainnet.sui.io/graphql -H 'content-type: application/json' -d "{\"query\":\"{ address(address: \\\"$ADDR\\\") { objects(filter:{type:\\\"0xd22b24490e0bae52676651b4f56660a5ff8022a2576e0089f79b3c88d44e08f0::suins_registration::SuinsRegistration\\\"}) { nodes { address contents { json } } } } }\"}"
```

You are looking for `"domain_name":"weed420.sui"` and, next to it, the object `address`.
Check `expiration_timestamp_ms` is in the future.

Write down two things and add them to `.env`:

```
SUINS_OBJECT_ID=0x7d1e6da06cb27c0d176b8aaa3cdf66449e6c9b02e70d5dea6ee6c38d8c37d801
SUINS_OWNER_ADDRESS=0x98a945d6523ba0b4685c4d50d0449c811fded93ad7a20cf2d61af6a6fd4d4d0b
```

Make sure that owner address has some mainnet SUI. The registration cost about 0.009 SUI.

## Step 6: register the name and point testnet at your PackageInfo (mainnet)

Dry run first. Nothing is sent, you just see what would happen:

```bash
SUI_NETWORK=mainnet SUI_SIGNER_ADDRESS=$SUINS_OWNER_ADDRESS node scripts/05-register-name.mjs
```

Expected:

```
register @weed420/vault from 0x98a9... on mainnet
dry run: success
gas: {...}
would create: ...::app_record::AppCap
re-run with --execute to send it
```

If the dry run says success, send it:

```bash
SUI_NETWORK=mainnet SUI_SIGNER_ADDRESS=$SUINS_OWNER_ADDRESS node scripts/05-register-name.mjs --execute
```

Expected:

```
status: success
digest: CsfHmG38UJZQcMxw6xRifYHceeW6SFzYExmRiTq9o8XF
created: ...::app_record::AppCap 0x242d24bf4c3a47ea01b2de51badaa534697f77969a1c275fb9c3124a97d222d7
```

What that one transaction did:

1. `move_registry::register(registry, your SuiNS NFT, "vault", clock)` created the app
   `@weed420/vault` and gave you an `AppCap`
2. `app_info::new(package_info_id, package_address, upgrade_cap_id)` built a small record of
   your testnet package
3. `move_registry::set_network(registry, cap, "4c78adac", that record)` attached it to the
   name under testnet's chain id
4. sent the AppCap to your wallet

Write down the AppCap ID. You need it later to re-point the name or to add mainnet.

The CLI form of the same transaction:

```bash
sui client switch --env mainnet
sui client switch --address crazy-prase          # the SuiNS owner
sui client ptb \
  --move-call @mvr/core::move_registry::register \
      @0x0e5d473a055b6b7d014af557a13ad9075157fdc19b6d51562a18511afd397727 \
      @$SUINS_OBJECT_ID '"vault"' @0x6 --assign cap \
  --move-call @mvr/core::app_info::new \
      "some(@$TESTNET_PACKAGE_INFO_ID)" "some(@$VAULT_PACKAGE_ID)" "some(@$UPGRADE_CAP_ID)" --assign info \
  --move-call @mvr/core::move_registry::set_network \
      @0x0e5d473a055b6b7d014af557a13ad9075157fdc19b6d51562a18511afd397727 cap '"4c78adac"' info \
  --transfer-objects '[cap]' @$SUINS_OWNER_ADDRESS \
  --gas-budget 50000000
```

`0x0e5d...7727` is the registry. It is always that object. `0x6` is the clock. `4c78adac` is
testnet's chain id.

## Step 7: check it worked

The CLI reads the chain directly, so it is correct immediately:

```bash
mvr resolve @weed420/vault --network testnet
```

Expected: a JSON block ending in `"package_address": "0x5583..."`.

The HTTP resolver is an index and can lag a few minutes:

```bash
curl -s https://testnet.mvr.mystenlabs.com/v1/names/@weed420/vault
```

If it says "not found", wait and retry. The chain is right; the index is catching up.

Then use the name:

```bash
pnpm call-by-name                         # TypeScript: deposit via @weed420/vault::vault::deposit
cd move/consumer && mvr add @weed420/vault && sui move build    # Move: depend on it
```

The Move dependency only builds if the git repo recorded in step 3 is public and the path is
right, because the mvr binary fetches the source from there.

---

## The website path (what we did for @weed420/vault2)

1. Publish on mainnet and create a PackageInfo with a display name:
   `SUI_NETWORK=mainnet node scripts/06-package-info-for.mjs <UPGRADE_CAP_ID> @weed420/<app> "<card name>" <git subdir> <SUINS_OWNER_ADDRESS>`
   The last argument sends the PackageInfo to the wallet you will connect to the site.
2. Open moveregistry.com/apps, connect the SuiNS owner wallet on mainnet.
3. Create Package: organisation `@weed420`, name `<app>`, description, docs URL.
4. Mainnet metadata: pick your card. This binding is permanent. Testnet metadata: optional, changeable.
5. Tick the irreversible box, create, sign once.
6. `mvr resolve @weed420/<app> --network mainnet`.

The site never asks for a package ID or UpgradeCap because the PackageInfo you pick already
contains both. PackageInfo has no `store` ability, so it moves only via
`@mvr/metadata::package_info::transfer`, not `sui client transfer`.

## Later: things you will do again

**After you upgrade the package.** Nothing on the registry. Add git info for the new version so
Move dependencies can fetch matching source:

```
package_info::set_git_versioning(PackageInfo, 2, git::new(repo, "move/vault", "v2-tag"))
```

**To put the same name on mainnet.** Publish on mainnet, create a mainnet PackageInfo (step 3
on mainnet), then `move_registry::assign_package(registry, AppCap, PackageInfo)`. This one is
permanent.

**To move the testnet pointer.** `move_registry::unset_network(registry, AppCap, "4c78adac")`
then `set_network` again with the new record.

**Before you burn the UpgradeCap.** Do all of the above first. PackageInfo is created from the
cap; once it is burned, the package can no longer be named.

---

## The whole thing on one screen

```
testnet   sui client publish                     -> PACKAGE_ID, UPGRADE_CAP_ID, VAULT_OBJECT_ID
testnet   pnpm register                          -> TESTNET_PACKAGE_INFO_ID
mainnet   find SuiNS NFT + owner wallet          -> SUINS_OBJECT_ID, SUINS_OWNER_ADDRESS
mainnet   node scripts/05-register-name.mjs      -> dry run
mainnet   node scripts/05-register-name.mjs --execute   -> AppCap, name live
any       mvr resolve @weed420/vault --network testnet  -> package address
```
