/**
 * CryptoService 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CryptoService, maskApiKey } from "./cryptoService";

describe("CryptoService", () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe("encrypt", () => {
    it("应返回包含 ciphertext 和 iv 的对象", async () => {
      const result = await cryptoService.encrypt("test");
      expect(result).toHaveProperty("ciphertext");
      expect(result).toHaveProperty("iv");
      expect(typeof result.ciphertext).toBe("string");
      expect(typeof result.iv).toBe("string");
    });

    it("应正确加密普通字符串", async () => {
      const plaintext = "Hello, World!";
      const result = await cryptoService.encrypt(plaintext);
      expect(result.ciphertext).not.toBe(plaintext);
      expect(result.ciphertext.length).toBeGreaterThan(0);
    });

    it("应正确处理空字符串", async () => {
      const result = await cryptoService.encrypt("");
      expect(result.ciphertext).toBe("");
      expect(result.iv).toBe("");
    });

    it("应正确处理中文字符", async () => {
      const plaintext = "你好，世界！";
      const result = await cryptoService.encrypt(plaintext);
      expect(result.ciphertext).not.toBe(plaintext);
    });
  });

  describe("decrypt", () => {
    it("应正确解密加密后的字符串", async () => {
      const plaintext = "Hello, World!";
      const encrypted = await cryptoService.encrypt(plaintext);
      const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
      expect(decrypted).toBe(plaintext);
    });

    it("应正确解密空字符串", async () => {
      const encrypted = await cryptoService.encrypt("");
      const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
      expect(decrypted).toBe("");
    });

    it("应正确解密中文字符", async () => {
      const plaintext = "你好，世界！";
      const encrypted = await cryptoService.encrypt(plaintext);
      const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("IV 唯一性", () => {
    it("每次加密应生成不同的 IV", async () => {
      const plaintext = "test";
      const result1 = await cryptoService.encrypt(plaintext);
      const result2 = await cryptoService.encrypt(plaintext);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it("相同明文加密后密文应不同", async () => {
      const plaintext = "test";
      const result1 = await cryptoService.encrypt(plaintext);
      const result2 = await cryptoService.encrypt(plaintext);
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });
  });
});

describe("maskApiKey", () => {
  it("应正确掩码长 API Key", () => {
    const apiKey = "sk-1234567890abcdef";
    const masked = maskApiKey(apiKey);
    expect(masked).toBe("sk-1••••••••cdef");
  });

  it("应完全掩码短 API Key", () => {
    const apiKey = "short12345";
    const masked = maskApiKey(apiKey);
    expect(masked).toBe("••••••••");
  });

  it("应处理空字符串", () => {
    expect(maskApiKey("")).toBe("••••••••");
  });

  it("应处理 undefined", () => {
    expect(maskApiKey(undefined as unknown as string)).toBe("••••••••");
  });

  it("应正确处理刚好 12 个字符的 Key", () => {
    const apiKey = "123456789012";
    const masked = maskApiKey(apiKey);
    expect(masked).toBe("1234••••••••9012");
  });
});
