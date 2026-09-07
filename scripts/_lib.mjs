import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { namedPackagesPlugin } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { fromBase64 } from "@mysten/sui/utils";

loadDotEnv();

export const NETWORK = process.env.SUI_NETWORK ?? "testnet";
export const MVR_URL = `https://${NETWORK}.mvr.mystenlabs.com`;
// Mysten's public fullnodes stopped serving JSON-RPC in July 2026 (full removal
// mid-October). This SDK's gRPC client cannot yet resolve transaction inputs, so
// for the class we use a provider that still serves JSON-RPC on testnet.
export const RPC_URL = process.env.SUI_RPC_URL
  ?? (NETWORK === "testnet" ? "https://sui-testnet-rpc.publicnode.com" : "https://sui-rpc.publicnode.com");
export const client = new SuiClient({ url: RPC_URL });

// Register the MVR plugin once. Every Transaction built afterwards can use
// @name/pkg::module::fn as a target and @name/pkg::module::Type in type args.
Transaction.registerGlobalSerializationPlugin(
  "namedPackagesPlugin",
  namedPackagesPlugin({ url: MVR_URL }),
);

export function env(name, fallback) {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env ${name} (see .env.example)`);
}

export function vaultTarget(fn) {
  const name = process.env.MVR_NAME;
  if (name && !name.includes("yourname")) return `${name}::vault::${fn}`;
  return `${env("VAULT_PACKAGE_ID")}::vault::${fn}`;
}

export function signer() {
  const pk = process.env.SUI_PRIVATE_KEY;
  if (pk) return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(pk).secretKey);
  // Fall back to the active key in the sui CLI keystore.
  const cfg = join(homedir(), ".sui", "sui_config");
  // SUI_SIGNER_ADDRESS picks a specific key from the keystore; otherwise the CLI's active address.
  const active = process.env.SUI_SIGNER_ADDRESS
    ?? readFileSync(join(cfg, "client.yaml"), "utf8").match(/active_address:\s*"?(0x[0-9a-fA-F]+)"?/)?.[1];
  const keys = JSON.parse(readFileSync(join(cfg, "sui.keystore"), "utf8"));
  for (const k of keys) {
    const bytes = fromBase64(k);
    if (bytes[0] !== 0) continue; // ed25519 only
    const kp = Ed25519Keypair.fromSecretKey(bytes.slice(1));
    if (!active || kp.toSuiAddress() === active) return kp;
  }
  throw new Error("No ed25519 key found in ~/.sui/sui_config/sui.keystore");
}

export async function run(tx, kp) {
  const res = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: kp,
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  });
  return res;
}

export function explorer(digest) {
  return `https://suiscan.xyz/${NETWORK}/tx/${digest}`;
}

// Loads .env, then .env.<SUI_NETWORK> on top of it (so `SUI_NETWORK=mainnet`
// picks up .env.mainnet). Variables already set in the shell win.
function loadDotEnv() {
  const base = join(process.cwd(), ".env");
  const shellNet = process.env.SUI_NETWORK;
  const files = [];
  if (existsSync(base)) files.push(base);
  const net = shellNet ?? readVar(base, "SUI_NETWORK") ?? "testnet";
  const perNet = join(process.cwd(), `.env.${net}`);
  if (existsSync(perNet)) files.push(perNet);
  const seen = new Set(Object.keys(process.env));
  for (const f of files.reverse()) {              // per-network first so it overrides base
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !seen.has(m[1])) { process.env[m[1]] = m[2].replace(/^"|"$/g, ""); seen.add(m[1]); }
    }
  }
}
function readVar(file, key) {
  if (!existsSync(file)) return undefined;
  const m = readFileSync(file, "utf8").match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, "m"));
  return m?.[1];
}
