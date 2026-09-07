// Create a PackageInfo for any package you hold the UpgradeCap of, give it a
// display name (what moveregistry.com shows in its dropdowns), default
// metadata, git info, and send it to a wallet (defaults to yours).
//
// Usage:
//   SUI_NETWORK=mainnet node scripts/06-package-info-for.mjs <UPGRADE_CAP_ID> <@name/app> <displayName> <gitSubdir> [toAddress]
import { Transaction } from "@mysten/sui/transactions";
import { env, explorer, run, signer } from "./_lib.mjs";

const [cap, name, displayName, subdir, to] = process.argv.slice(2);
if (!cap || !name || !displayName || !subdir) {
  console.error("usage: <UPGRADE_CAP_ID> <@name/app> <displayName> <gitSubdir> [toAddress]");
  process.exit(1);
}
const kp = signer();
const recipient = to ?? kp.toSuiAddress();
const repo = env("GIT_REPO", "https://github.com/Nuel-osas/day1-move-registry-debugger");

const tx = new Transaction();
const info = tx.moveCall({ target: "@mvr/metadata::package_info::new", arguments: [tx.object(cap)] });
const display = tx.moveCall({ target: "@mvr/metadata::display::default", arguments: [tx.pure.string(displayName)] });
tx.moveCall({ target: "@mvr/metadata::package_info::set_display", arguments: [info, display] });
tx.moveCall({ target: "@mvr/metadata::package_info::set_metadata", arguments: [info, tx.pure.string("default"), tx.pure.string(name)] });
const git = tx.moveCall({ target: "@mvr/metadata::git::new", arguments: [tx.pure.string(repo), tx.pure.string(subdir), tx.pure.string("main")] });
tx.moveCall({ target: "@mvr/metadata::package_info::set_git_versioning", arguments: [info, tx.pure.u64(1), git] });
tx.moveCall({ target: "@mvr/metadata::package_info::transfer", arguments: [info, tx.pure.address(recipient)] });

const res = await run(tx, kp);
console.log(`${displayName}: ${res.effects.status.status} ${res.effects.status.error ?? ""}  ${explorer(res.digest)}`);
for (const c of res.objectChanges ?? []) if (c.type === "created" && c.objectType.endsWith("::package_info::PackageInfo")) console.log(`  PackageInfo ${c.objectId} -> ${recipient}`);
