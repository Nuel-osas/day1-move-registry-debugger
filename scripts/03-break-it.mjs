// Reproduce the bug on-chain, then hand the digest to `sui replay --trace`.
//
// The guard in `withdraw` counts the treasury as withdrawable:
//   available = funds + treasury;  assert!(available >= amount)
// So withdrawing (funds + 1) passes the guard whenever treasury >= 1, and then
// `sui::balance::split` aborts with ENotEnough (2) instead of the vault's own
// EInsufficientBalance (30). This script reads the live vault, makes sure the
// treasury is non-zero, and sends exactly that withdrawal.
import { Transaction } from "@mysten/sui/transactions";
import { client, env, explorer, run, signer, vaultTarget } from "./_lib.mjs";

const kp = signer();
const vaultId = env("VAULT_OBJECT_ID");
const me = kp.toSuiAddress();

async function vault() {
  const o = await client.getObject({ id: vaultId, options: { showContent: true } });
  const f = o.data.content.fields;
  return { funds: BigInt(f.funds), treasury: BigInt(f.treasury), feeBps: BigInt(f.fee_bps) };
}

async function deposit(amount) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [amount]);
  tx.moveCall({ target: vaultTarget("deposit"), arguments: [tx.object(vaultId), coin] });
  return run(tx, kp);
}

async function withdraw(amount) {
  const tx = new Transaction();
  // Explicit budget: without it the SDK dry-runs to estimate gas, and a dry run
  // that aborts throws before anything reaches the chain. We want the failure
  // recorded on-chain so it has a digest we can replay.
  tx.setGasBudget(20_000_000);
  const out = tx.moveCall({ target: vaultTarget("withdraw"), arguments: [tx.object(vaultId), tx.pure.u64(amount)] });
  tx.transferObjects([out], me);
  return run(tx, kp);
}

let v = await vault();
console.log(`vault before   funds=${v.funds} treasury=${v.treasury} fee_bps=${v.feeBps}`);

if (v.funds < 10_000n) {
  const r = await deposit(10_000n);
  console.log(`deposit 10_000   ${r.effects.status.status}  ${r.digest}`);
}
if (v.treasury === 0n) {
  const r = await withdraw(1_000n); // pays a fee, so treasury becomes non-zero
  console.log(`withdraw 1_000   ${r.effects.status.status}  ${r.digest}`);
}
v = await vault();
const amount = v.funds + 1n;
console.log(`vault now      funds=${v.funds} treasury=${v.treasury}`);
console.log(`withdraw ${amount}: guard sees ${v.funds + v.treasury} >= ${amount}, passes; split will fail`);

const r = await withdraw(amount);
console.log(`withdraw ${amount}   ${r.effects.status.status}  ${r.digest}`);
console.log(`error: ${r.effects.status.error ?? "(none)"}`);
console.log(`\n${explorer(r.digest)}`);
console.log(`\nNow trace it:\n  sui replay --trace --digest ${r.digest}\n  code .replay/${r.digest}   # then Run > Start Debugging on trace.json.zst`);
