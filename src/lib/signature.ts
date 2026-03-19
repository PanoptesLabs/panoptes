import { Secp256k1, Secp256k1Signature, sha256, ripemd160, keccak256 } from "@cosmjs/crypto";
import { serializeSignDoc, type StdSignDoc } from "@cosmjs/amino";
import { fromBase64, toBech32 } from "@cosmjs/encoding";

/**
 * Derive bech32 address from a public key.
 * Tries standard Cosmos (ripemd160(sha256)) first, then Ethermint (keccak256).
 * Returns the matching derivation or null.
 */
function deriveAddress(pubkeyBytes: Uint8Array, expectedAddress: string): boolean {
  // Standard Cosmos: ripemd160(sha256(pubkey))
  const cosmosHash = ripemd160(sha256(pubkeyBytes));
  if (toBech32("rai", cosmosHash) === expectedAddress) return true;

  // Ethermint: keccak256(uncompressed pubkey without prefix)[12:]
  // Compressed pubkeys are 33 bytes; we need the raw 65-byte form for keccak
  // For compressed keys, Secp256k1 decompression is needed — skip if already uncompressed
  try {
    const uncompressed = pubkeyBytes.length === 33
      ? decompressPubkey(pubkeyBytes)
      : pubkeyBytes;
    // Drop the 0x04 prefix (1 byte) → 64 bytes → keccak256 → last 20 bytes
    const raw = uncompressed.length === 65 ? uncompressed.slice(1) : uncompressed;
    const ethHash = keccak256(raw).slice(12);
    if (toBech32("rai", ethHash) === expectedAddress) return true;
  } catch {
    // Decompression failed — not an issue, just means it's not ethsecp256k1
  }

  return false;
}

/**
 * Decompress a 33-byte compressed secp256k1 public key to 65-byte uncompressed form.
 * Uses the secp256k1 curve equation: y² = x³ + 7 (mod p)
 */
function decompressPubkey(compressed: Uint8Array): Uint8Array {
  if (compressed.length !== 33) throw new Error("Invalid compressed pubkey length");

  const p = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
  const prefix = compressed[0];
  const xBytes = compressed.slice(1);

  let x = BigInt(0);
  for (const b of xBytes) x = (x << BigInt(8)) | BigInt(b);

  // y² = x³ + 7 (mod p)
  const ySquared = (modPow(x, BigInt(3), p) + BigInt(7)) % p;
  let y = modPow(ySquared, (p + BigInt(1)) / BigInt(4), p);

  // Choose correct y parity
  const isEven = y % BigInt(2) === BigInt(0);
  if ((prefix === 0x02 && !isEven) || (prefix === 0x03 && isEven)) {
    y = p - y;
  }

  const result = new Uint8Array(65);
  result[0] = 0x04;
  const xArr = bigintToBytes(x, 32);
  const yArr = bigintToBytes(y, 32);
  result.set(xArr, 1);
  result.set(yArr, 33);
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
 * Verify an ADR-036 arbitrary data signature.
 *
 * @param address - bech32 signer address (rai1...)
 * @param data - the raw data that was signed (e.g. nonce string)
 * @param pubKeyBase64 - base64-encoded secp256k1 public key (33 bytes compressed)
 * @param signatureBase64 - base64-encoded 64-byte signature
 * @returns true if valid
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

    // Verify pubkey derives to the claimed address (supports both Cosmos and Ethermint)
    if (!deriveAddress(pubkeyBytes, address)) {
      return false;
    }

    // Build ADR-036 sign doc
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

    const sig = Secp256k1Signature.fromFixedLength(sigBytes);
    return await Secp256k1.verifySignature(sig, messageHash, pubkeyBytes);
  } catch {
    return false;
  }
}
