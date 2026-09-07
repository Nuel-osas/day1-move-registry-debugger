// Deposit into the vault by NAME. The address never appears in this file.
import { Transaction } from "@mysten/sui/transactions";
import { client, env, explorer, run, signer, vaultTarget } from "./_lib.mjs";

const kp = signer();
const vaultId = env("VAULT_OBJECT_ID");
const amount = BigInt(process.argv[2] ?? 10_000_000); // 0.01 SUI

const tx = new Transaction();
const [coin] = tx.splitCoins(tx.gas, [amount]);
tx.moveCall({ target: vaultTarget("deposit"), arguments: [tx.object(vaultId), coin] });

console.log(`calling ${vaultTarget("deposit")} as ${kp.toSuiAddress()}`);
const res = await run(tx, kp);
console.log(`status: ${res.effects.status.status}`);
console.log(`digest: ${res.digest}\n${explorer(res.digest)}`);
for (const e of res.events ?? []) console.log("event:", e.type.split("::").slice(1).join("::"), e.parsedJson);
const v = await client.getObject({ id: vaultId, options: { showContent: true } });
const f = v.data.content.fields;
console.log(`vault v${f.version}  treasury=${f.treasury}  fee_bps=${f.fee_bps}  state=${f.state?.variant ?? f.state}`);
