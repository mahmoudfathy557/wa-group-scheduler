import { CryptoService } from "./crypto.service";

describe("CryptoService", () => {
  let svc: CryptoService;

  beforeEach(() => {
    svc = new CryptoService();
    svc.setKeyForTesting(Buffer.alloc(32, 0x42));
  });

  it("encrypts and decrypts a string roundtrip", () => {
    const plain = "hello, whatsapp ✅";
    const enc = svc.encrypt(plain);
    expect(enc.length).toBeGreaterThan(plain.length);
    expect(svc.decryptString(enc)).toBe(plain);
  });

  it("produces unique ciphertexts for the same plaintext (random IV)", () => {
    const a = svc.encrypt("same");
    const b = svc.encrypt("same");
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it("rejects tampered ciphertext (auth tag fails)", () => {
    const enc = svc.encrypt("payload");
    enc[enc.length - 1] = enc[enc.length - 1] ^ 0xff;
    expect(() => svc.decrypt(enc)).toThrow();
  });

  it("rejects too-short input", () => {
    expect(() => svc.decrypt(Buffer.alloc(5))).toThrow();
  });
});
