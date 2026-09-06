# Setup

Do this before class. The downloads are slow on hub WiFi.

## 1. Sui CLI (Homebrew build, tracing enabled)

```bash
brew install sui           # or: brew upgrade sui
sui --version              # 1.79.0 or newer
sui move test --help | grep -- --trace
```

If `--trace` is missing you have a build without the tracing feature. Reinstall from Homebrew.

## 2. Testnet wallet with gas

```bash
sui client switch --env testnet
sui client active-address
sui client faucet
sui client gas
```

## 3. Node 20+, pnpm, the SDK

```bash
node --version             # v20 or newer
npm i -g pnpm
git clone https://github.com/Nuel-osas/day1-move-registry-debugger
cd day1-move-registry-debugger
pnpm install
cp scripts/deployed.testnet.env .env
```

## 4. The mvr CLI

```bash
cargo install --locked --git https://github.com/mystenlabs/mvr --branch release mvr
mvr --version
export MVR_FALLBACK_NETWORK=testnet     # add to your shell profile
```

No Rust? Download a binary from the mvr GitHub releases page, rename it `mvr`, `chmod +x`, put it on PATH.

## 5. VS Code extensions

```
mysten.move                 Move Analyzer: autocomplete, hover types, formatter
mysten.move-trace-debug     Move Trace Debugger
```

Install from the Extensions view or `code --install-extension <id>`.

## 6. Optional: a mainnet SuiNS name

Only needed if you want to register your own MVR name in class. Everything else works without one.
Check your names at suins.io. Expired names have a 30-day grace period.

## Check

```bash
cd move/vault && sui move test --trace && ls traces/ && cd ../..
pnpm resolve
```

If both print output you are ready.
