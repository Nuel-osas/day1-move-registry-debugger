// Register @<suins>/<app> in the Move Registry and point its TESTNET entry at
// the PackageInfo created by 04. This transaction runs on MAINNET (the registry
// lives there) and must be signed by the wallet that owns the SuiNS name.
//
// Usage:
//   SUI_NETWORK=mainnet SUI_SIGNER_ADDRESS=<suins owner> node scripts/05-register-name.mjs           # dry run
//   SUI_NETWORK=mainnet SUI_SIGNER_ADDRESS=<suins owner> node scripts/05-register-name.mjs --execute
import { Transaction } from "@mysten/sui/transactions";
import { client, env, explorer, run, signer } from "./_lib.mjs";

const REGISTRY = "0x0e5d473a055b6b7d014af557a13ad9075157fdc19b6d51562a18511afd397727";
const TESTNET_CHAIN_ID = "4c78adac";

const kp = signer();
const suinsNft = env("SUINS_OBJECT_ID");
const name = env("MVR_NAME");                       // e.g. @weed420/vault
const app = name.split("/")[1];
const testnetPackageInfo = env("TESTNET_PACKAGE_INFO_ID");
const testnetPackage = env("VAULT_PACKAGE_ID");
const testnetUpgradeCap = env("UPGRADE_CAP_ID");
const execute = process.argv.includes("--execute");

const tx = new Transaction();
tx.setSender(kp.toSuiAddress());
const cap = tx.moveCall({
  target: "@mvr/core::move_registry::register",
  arguments: [tx.object(REGISTRY), tx.object(suinsNft), tx.pure.string(app), tx.object("0x6")],
});
const info = tx.moveCall({
  target: "@mvr/core::app_info::new",
  arguments: [
    tx.pure.option("id", testnetPackageInfo),
    tx.pure.option("address", testnetPackage),
    tx.pure.option("id", testnetUpgradeCap),
  ],
});
tx.moveCall({
  target: "@mvr/core::move_registry::set_network",
  arguments: [tx.object(REGISTRY), cap, tx.pure.string(TESTNET_CHAIN_ID), info],
});
tx.transferObjects([cap], kp.toSuiAddress());

console.log(`register ${name} from ${kp.toSuiAddress()} on ${process.env.SUI_NETWORK}`);
if (!execute) {
  const dry = await client.dryRunTransactionBlock({ transactionBlock: await tx.build({ client }) });
  console.log(`dry run: ${dry.effects.status.status} ${dry.effects.status.error ?? ""}`);
  console.log(`gas: ${JSON.stringify(dry.effects.gasUsed)}`);
  for (const c of dry.objectChanges ?? []) if (c.type === "created") console.log("would create:", c.objectType);
  console.log("\nre-run with --execute to send it");
  process.exit(dry.effects.status.status === "success" ? 0 : 1);
}
const res = await run(tx, kp);
console.log(`status: ${res.effects.status.status} ${res.effects.status.error ?? ""}`);
console.log(`digest: ${res.digest}\n${explorer(res.digest)}`);
for (const c of res.objectChanges ?? []) if (c.type === "created") console.log("created:", c.objectType, c.objectId);
