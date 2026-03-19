import { describe, it, expect } from "vitest";
import { verifyAdr036Signature } from "@/lib/signature";

describe("verifyAdr036Signature", () => {
  it("returns false for invalid base64 pubkey", async () => {
    const result = await verifyAdr036Signature(
      "rai1abc",
      "nonce-data",
      "not-base64!!!",
      "also-not-base64!!!",
    );
    expect(result).toBe(false);
  });

  it("returns false for empty inputs", async () => {
    const result = await verifyAdr036Signature("", "", "", "");
    expect(result).toBe(false);
  });

  it("returns false when pubkey does not derive to address", async () => {
    // Valid base64 but wrong pubkey for address
    const fakePubkey = Buffer.from(new Uint8Array(33).fill(2)).toString("base64");
    const fakeSig = Buffer.from(new Uint8Array(64).fill(0)).toString("base64");

    const result = await verifyAdr036Signature(
      "rai1abc123def456ghi789jkl012mno345pqrs678",
      "test-nonce",
      fakePubkey,
      fakeSig,
    );
    expect(result).toBe(false);
  });

  it("returns false for malformed signature bytes", async () => {
    const fakePubkey = Buffer.from(new Uint8Array(33).fill(2)).toString("base64");
    const shortSig = Buffer.from(new Uint8Array(32).fill(0)).toString("base64");

    const result = await verifyAdr036Signature(
      "rai1test",
      "test-nonce",
      fakePubkey,
      shortSig,
    );
    expect(result).toBe(false);
  });
});
