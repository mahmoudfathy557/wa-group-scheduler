import { Injectable, OnModuleInit } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * AES-256-GCM authenticated encryption. Output format:
 *   [ 12 bytes IV | 16 bytes auth tag | ciphertext ]
 *
 * Key is hex-encoded in env (must decode to exactly 32 bytes).
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private key!: Buffer;

  onModuleInit() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex) {
      throw new Error("ENCRYPTION_KEY env var is required");
    }
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error("ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes)");
    }
    this.key = Buffer.from(hex, "hex");
  }

  // Allow tests to inject a key without going through onModuleInit.
  setKeyForTesting(buf: Buffer) {
    if (buf.length !== 32) throw new Error("Key must be 32 bytes");
    this.key = buf;
  }

  encrypt(plaintext: Buffer | string): Buffer {
    const data =
      typeof plaintext === "string"
        ? Buffer.from(plaintext, "utf8")
        : plaintext;
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  }

  decrypt(payload: Buffer): Buffer {
    if (payload.length < IV_LEN + TAG_LEN) {
      throw new Error("Ciphertext too short");
    }
    const iv = payload.subarray(0, IV_LEN);
    const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = payload.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  decryptString(payload: Buffer): string {
    return this.decrypt(payload).toString("utf8");
  }
}
