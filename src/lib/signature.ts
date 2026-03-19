import { Secp256k1, Secp256k1Signature, sha256, ripemd160 } from "@cosmjs/crypto";
import { serializeSignDoc, type StdSignDoc } from "@cosmjs/amino";
import { fromBase64, toBech32 } from "@cosmjs/encoding";

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

    // Verify pubkey derives to the claimed address
    const pubkeyHash = ripemd160(sha256(pubkeyBytes));
    const derivedAddress = toBech32("rai", pubkeyHash);
    if (derivedAddress !== address) {
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
