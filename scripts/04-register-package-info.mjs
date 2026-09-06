// Create the PackageInfo object for the vault on this network and attach
// metadata + git info. Run once per network after publishing.
// Requires: UPGRADE_CAP_ID in .env, and the @mvr/metadata package (resolved by name).
import { Transaction } from "@mysten/sui/transactions";
import { env, explorer, run, signer } from "./_lib.mjs";

const kp = signer();
const upgradeCap = env("UPGRADE_CAP_ID");
const name = env("MVR_NAME");
const repo = env("GIT_REPO", "https://github.com/Nuel-osas/day1-move-registry-debugger");
const subdir = env("GIT_SUBDIR", "move/vault");
const rev = env("GIT_REV", "main");

const tx = new Transaction();
const info = tx.moveCall({ target: "@mvr/metadata::package_info::new", arguments: [tx.object(upgradeCap)] });
tx.moveCall({
  target: "@mvr/metadata::package_info::set_metadata",
  arguments: [info, tx.pure.string("default"), tx.pure.string(name)],
});
const git = tx.moveCall({
  target: "@mvr/metadata::git::new",
  arguments: [tx.pure.string(repo), tx.pure.string(subdir), tx.pure.string(rev)],
});
tx.moveCall({ target: "@mvr/metadata::package_info::set_git_versioning", arguments: [info, tx.pure.u64(1), git] });
tx.moveCall({ target: "@mvr/metadata::package_info::transfer", arguments: [info, tx.pure.address(kp.toSuiAddress())] });

const res = await run(tx, kp);
console.log(`status: ${res.effects.status.status}  ${res.effects.status.error ?? ""}`);
console.log(`digest: ${res.digest}\n${explorer(res.digest)}`);
for (const c of res.objectChanges ?? []) if (c.type === "created") console.log("created:", c.objectType, c.objectId);
