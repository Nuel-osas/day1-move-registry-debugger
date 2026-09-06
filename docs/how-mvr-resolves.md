# How MVR resolves a name

1. A name is `@<suins>/<app>`, optionally `/<version>`.
2. The registry is one object on mainnet: `0x0e5d473a055b6b7d014af557a13ad9075157fdc19b6d51562a18511afd397727`.
   `register(registry, suins_nft, app, clock)` returns an `AppCap`.
3. Per network:
   - mainnet: `assign_package(registry, cap, package_info)`. Permanent.
   - others: `set_network(registry, cap, chain_id, app_info)`. Testnet chain id is `4c78adac`.
     `unset_network` then `set_network` again to move it.
4. `PackageInfo` lives on the network the package is on. It is created from the `UpgradeCap`
   with `@mvr/metadata::package_info::new`, carries metadata (`default` = the name) and git info.
5. Resolvers: `https://mainnet.mvr.mystenlabs.com` and `https://testnet.mvr.mystenlabs.com`.
   `GET /v1/names/<name>` returns metadata plus the network's package address.
   `POST /v1/resolution/bulk {"names":[...]}` is what the SDK plugin calls.
6. Consumers:
   - Move.toml: `dep = { r.mvr = "@name/app" }`; `sui move build` shells out to the `mvr` binary.
   - TypeScript: `namedPackagesPlugin({ url })` registered on `Transaction`.
   - CLI: `sui client ptb --move-call @name/app::module::fn ...`.
