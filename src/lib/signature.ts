import { Secp256k1, Secp256k1Signature, sha256, ripemd160, keccak256 } from "@cosmjs/crypto";
import { serializeSignDoc, type StdSignDoc } from "@cosmjs/amino";
import { fromBase64, toBech32 } from "@cosmjs/encoding";

/**
 * Derive Ethermint bech32 address from a compressed public key.
 * Uses keccak256(uncompressed_pubkey_without_04_prefix)[12:] → bech32
 */
function deriveEthermintAddress(pubkeyBytes: Uint8Array): string {
  const uncompressed = decompressPubkey(pubkeyBytes);
  // Drop the 0x04 prefix → 64 bytes → keccak256 → last 20 bytes
  const ethHash = keccak256(uncompressed.slice(1)).slice(12);
  return toBech32("rai", ethHash);
}

/**
 * Derive standard Cosmos bech32 address from a public key.
 * Uses ripemd160(sha256(pubkey)) → bech32
 */
function deriveCosmosAddress(pubkeyBytes: Uint8Array): string {
  return toBech32("rai", ripemd160(sha256(pubkeyBytes)));
}


/**
 * Decompress a 33-byte compressed secp256k1 public key to 65-byte uncompressed form.
 */
function decompressPubkey(compressed: Uint8Array): Uint8Array {
  if (compressed.length !== 33) throw new Error("Invalid compressed pubkey length");

  const p = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
  const prefix = compressed[0];
  const xBytes = compressed.slice(1);

  let x = BigInt(0);
  for (const b of xBytes) x = (x << BigInt(8)) | BigInt(b);

  const ySquared = (modPow(x, BigInt(3), p) + BigInt(7)) % p;
  let y = modPow(ySquared, (p + BigInt(1)) / BigInt(4), p);

  const isEven = y % BigInt(2) === BigInt(0);
  if ((prefix === 0x02 && !isEven) || (prefix === 0x03 && isEven)) {
    y = p - y;
  }

  const result = new Uint8Array(65);
  result[0] = 0x04;
  result.set(bigintToBytes(x, 32), 1);
  result.set(bigintToBytes(y, 32), 33);
  return result;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = BigInt(1);
  base = base % mod;
  while (exp > BigInt(0)) {
    if (exp % BigInt(2) === BigInt(1)) result = (result * base) % mod;
    exp = exp >> BigInt(1);
    base = (base * base) % mod;
  }
  return result;
}

function bigintToBytes(n: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(n & BigInt(0xff));
    n = n >> BigInt(8);
  }
  return bytes;
}

/**
 * Verify an EIP-191 personal_sign signature (Ethermint / eth-key-sign).
 * Keplr wraps: "\x19Ethereum Signed Message:\n{byteLength}{data}"
 * Hashes with keccak256, signs with secp256k1.
 */
async function verifyEip191(
  pubkeyBytes: Uint8Array,
  data: string,
  sigBytes: Uint8Array,
): Promise<boolean> {
  const dataBytes = Buffer.from(data);
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${dataBytes.length}`);
  const messageHash = keccak256(Buffer.concat([prefix, dataBytes]));

  // eth-key-sign returns 65 bytes (r:32 + s:32 + v:1), strip recovery byte
  const rawSig = sigBytes.length === 65 ? sigBytes.slice(0, 64) : sigBytes;

  const sig = Secp256k1Signature.fromFixedLength(rawSig);
  return Secp256k1.verifySignature(sig, messageHash, pubkeyBytes);
}

/**
 * Verify a standard ADR-036 amino signature (Cosmos).
 */
async function verifyAdr036(
  address: string,
  pubkeyBytes: Uint8Array,
  data: string,
  sigBytes: Uint8Array,
): Promise<boolean> {
  const signDoc: StdSignDoc = {
    chain_id: "",
    account_number: "0",
    sequence: "0",
    fee: { gas: "0", amount: [] },
    msgs: [
      {
        type: "sign/MsgSignData",
        value: {
          signer: address,
          data: Buffer.from(data).toString("base64"),
        },
      },
    ],
    memo: "",
  };

  const serialized = serializeSignDoc(signDoc);
  const messageHash = sha256(serialized);

  const rawSig = sigBytes.length === 65 ? sigBytes.slice(0, 64) : sigBytes;
  const sig = Secp256k1Signature.fromFixedLength(rawSig);
  return Secp256k1.verifySignature(sig, messageHash, pubkeyBytes);
}

export interface SignatureResult {
  valid: boolean;
  debug: {
    pubkeyLength: number;
    sigLength: number;
    claimedAddress: string;
    ethermintAddress: string | null;
    cosmosAddress: string | null;
    addressMatch: "ethermint" | "cosmos" | "none";
    eip191Result: boolean | string;
    adr036Result: boolean | string;
  };
}

/**
 * Verify an arbitrary data signature from Keplr.
 * Tries EIP-191 (Ethermint/eth-key-sign) first, then ADR-036 (standard Cosmos).
 * Returns detailed diagnostics for debugging.
 */
export async function verifySignatureWithDiag(
  address: string,
  data: string,
  pubKeyBase64: string,
  signatureBase64: string,
): Promise<SignatureResult> {
  const debug: SignatureResult["debug"] = {
    pubkeyLength: 0,
    sigLength: 0,
    claimedAddress: address,
    ethermintAddress: null,
    cosmosAddress: null,
    addressMatch: "none",
    eip191Result: "skipped",
    adr036Result: "skipped",
  };

  try {
    const pubkeyBytes = fromBase64(pubKeyBase64);
    const sigBytes = fromBase64(signatureBase64);
    debug.pubkeyLength = pubkeyBytes.length;
    debug.sigLength = sigBytes.length;

    // Derive addresses
    try { debug.ethermintAddress = deriveEthermintAddress(pubkeyBytes); } catch (e) {
      debug.ethermintAddress = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }
    try { debug.cosmosAddress = deriveCosmosAddress(pubkeyBytes); } catch (e) {
      debug.cosmosAddress = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }

    // Check address match
    if (debug.ethermintAddress === address) debug.addressMatch = "ethermint";
    else if (debug.cosmosAddress === address) debug.addressMatch = "cosmos";
    else return { valid: false, debug };

    // Try EIP-191
    try {
      const eip191 = await verifyEip191(pubkeyBytes, data, sigBytes);
      debug.eip191Result = eip191;
      if (eip191) return { valid: true, debug };
    } catch (e) {
      debug.eip191Result = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }

    // Try ADR-036
    try {
      const adr036 = await verifyAdr036(address, pubkeyBytes, data, sigBytes);
      debug.adr036Result = adr036;
      if (adr036) return { valid: true, debug };
    } catch (e) {
      debug.adr036Result = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }

    return { valid: false, debug };
  } catch (e) {
    debug.eip191Result = `outer: ${e instanceof Error ? e.message : "unknown"}`;
    return { valid: false, debug };
  }
}

/**
 * Simple boolean wrapper for backward compatibility.
 */
export async function verifyAdr036Signature(
  address: string,
  data: string,
  pubKeyBase64: string,
  signatureBase64: string,
): Promise<boolean> {
  const result = await verifySignatureWithDiag(address, data, pubKeyBase64, signatureBase64);
  return result.valid;
}
