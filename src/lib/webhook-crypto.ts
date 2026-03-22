import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const HEX_64_RE = /^[a-fA-F0-9]{64}$/;
const VERSION_1 = 0x01;

function getEncryptionKey(): Buffer {
  const hex = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!hex || !HEX_64_RE.test(hex)) {
    throw new Error(
      "WEBHOOK_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

function getPreviousEncryptionKey(): Buffer | null {
  const hex = process.env.WEBHOOK_ENCRYPTION_KEY_PREVIOUS;
  if (!hex || !HEX_64_RE.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a webhook signing secret using AES-256-GCM.
 * Output: base64(version + iv + authTag + ciphertext)
 */
export function encryptSecret(plainSecret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainSecret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([VERSION_1]), iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a webhook signing secret from AES-256-GCM encrypted form.
 * Supports both versioned (v1 prefix) and legacy formats.
 * On failure with active key, tries previous key if available.
 */
export function decryptSecret(encryptedBase64: string): string {
  const data = Buffer.from(encryptedBase64, "base64");

  // Determine if versioned format (first byte is VERSION_1)
  const isVersioned = data.length > 0 && data[0] === VERSION_1;
  const payload = isVersioned ? data.subarray(1) : data;

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted data: too short");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // Try active key first, then previous key (generic error to prevent key-state leakage)
  const activeKey = getEncryptionKey();
  const prevKey = getPreviousEncryptionKey();

  for (const key of prevKey ? [activeKey, prevKey] : [activeKey]) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      continue;
    }
  }

  throw new Error("Decryption failed");
}

/**
 * Sign a payload using HMAC-SHA256.
 * Used for X-Webhook-Signature header.
 */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Generate a new webhook signing secret.
 * Format: "whsec_" + 32 random bytes as hex (64 chars)
 */
export function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(32).toString("hex");
}
