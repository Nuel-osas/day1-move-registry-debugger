// Resolve MVR names to package IDs with plain HTTP. No SDK needed.
// Shows the two things a name carries: metadata (mainnet registry) and the
// per-network package pointer.
import { MVR_URL, NETWORK } from "./_lib.mjs";

const names = process.argv.slice(2);
if (names.length === 0) names.push("@deepbook/core", "@suins/core", "@mvr/metadata", process.env.MVR_NAME ?? "@yourname/vault");

console.log(`network: ${NETWORK}  resolver: ${MVR_URL}\n`);
for (const name of names) {
  const r = await fetch(`${MVR_URL}/v1/names/${name}`);
  const body = await r.json();
  if (!r.ok) { console.log(`${name.padEnd(24)} ${body.message}`); continue; }
  const pkg = body.package_address ?? body.package_info?.package_address ?? "(no package on this network)";
  console.log(`${name.padEnd(24)} -> ${pkg}`);
  if (body.metadata?.description) console.log(`${"".padEnd(24)}    ${body.metadata.description.slice(0, 90)}`);
}

console.log("\nBulk resolution (what the SDK plugin calls under the hood):");
const bulk = await fetch(`${MVR_URL}/v1/resolution/bulk`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ names }),
});
console.log(JSON.stringify(await bulk.json(), null, 2));
