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
 * Check if pubkey derives to the expected address (Ethermint or Cosmos).
 */
function matchesAddress(pubkeyBytes: Uint8Array, expectedAddress: string): boolean {
  try {
    if (deriveEthermintAddress(pubkeyBytes) === expectedAddress) return true;
  } catch { /* decompression failed */ }

  try {
    if (deriveCosmosAddress(pubkeyBytes) === expectedAddress) return true;
  } catch { /* derivation failed */ }

  return false;
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

/**
 * Verify an arbitrary data signature from Keplr.
 * Tries EIP-191 (Ethermint/eth-key-sign) first, then ADR-036 (standard Cosmos).
 */
export async function verifyAdr036Signature(
  address: string,
  data: string,
  pubKeyBase64: string,
  signatureBase64: string,
): Promise<boolean> {
  try {
    const pubkeyBytes = fromBase64(pubKeyBase64);
    const sigBytes = fromBase64(signatureBase64);

    // Verify pubkey derives to the claimed address
    if (!matchesAddress(pubkeyBytes, address)) {
      return false;
    }

    // Try EIP-191 first (Ethermint chains with eth-key-sign)
    try {
      if (await verifyEip191(pubkeyBytes, data, sigBytes)) return true;
    } catch { /* fall through */ }

    // Fall back to standard ADR-036 (Cosmos chains)
    try {
      if (await verifyAdr036(address, pubkeyBytes, data, sigBytes)) return true;
    } catch { /* fall through */ }

    return false;
  } catch {
    return false;
  }
}
