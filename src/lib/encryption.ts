import { createCipheriv, randomBytes, scryptSync } from "crypto";

function getEncryptionKey(): Buffer {
  const storeKey = process.env.ENCRYPTION_STORE_KEY;
  if (!storeKey) {
    return Buffer.alloc(32);
  }
  return scryptSync(storeKey, "pos-encryption", 32);
}

export interface Encrypted {
  ciphertext: string;
  iv: string;
}

export function encryptVal(data: Buffer): Encrypted {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64")
  };
}

export function decryptVal(data: Encrypted): Buffer {
  const { createDecipheriv } = require("crypto");
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, "base64");
  const raw = Buffer.from(data.ciphertext, "base64");

  const encrypted = raw.subarray(0, raw.length - 16);
  const authTag = raw.subarray(raw.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function encryptStr(text: string): Encrypted {
  return encryptVal(Buffer.from(text, "utf8"));
}

export function decryptStr(data: Encrypted): string {
  return decryptVal(data).toString("utf8");
}