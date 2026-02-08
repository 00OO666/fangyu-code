/**
 * CryptoService 属性测试
 *
 * 使用 fast-check 进行属性测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { CryptoService, maskApiKey } from "./cryptoService";

describe("CryptoService Property Tests", () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe("加密解密往返一致性", () => {
    it("任意字符串加密后解密应得到原始值", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (plaintext) => {
          const encrypted = await cryptoService.encrypt(plaintext);
          const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
          return decrypted === plaintext;
        }),
        { numRuns: 100 }
      );
    });

    it("空字符串加密解密应正确处理", async () => {
      const encrypted = await cryptoService.encrypt("");
      const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
      expect(decrypted).toBe("");
    });

    it("特殊字符加密解密应正确处理", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringOf(
            fc.constantFrom(
              "!",
              "@",
              "#",
              "$",
              "%",
              "^",
              "&",
              "*",
              "(",
              ")",
              "中",
              "文",
              "日",
              "本",
              "語",
              "🎉",
              "🚀"
            )
          ),
          async (plaintext) => {
            const encrypted = await cryptoService.encrypt(plaintext);
            const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
            return decrypted === plaintext;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("长字符串加密解密应正确处理", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1000, maxLength: 10000 }), async (plaintext) => {
          const encrypted = await cryptoService.encrypt(plaintext);
          const decrypted = await cryptoService.decrypt(encrypted.ciphertext, encrypted.iv);
          return decrypted === plaintext;
        }),
        { numRuns: 10 }
      );
    });
  });

  describe("IV 唯一性", () => {
    it("每次加密应生成唯一的 IV", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (plaintext) => {
          const encrypted1 = await cryptoService.encrypt(plaintext);
          const encrypted2 = await cryptoService.encrypt(plaintext);
          // IV 应该不同
          return encrypted1.iv !== encrypted2.iv;
        }),
        { numRuns: 50 }
      );
    });

    it("相同明文加密后密文应不同（由于 IV 不同）", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (plaintext) => {
          const encrypted1 = await cryptoService.encrypt(plaintext);
          const encrypted2 = await cryptoService.encrypt(plaintext);
          // 密文应该不同
          return encrypted1.ciphertext !== encrypted2.ciphertext;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("maskApiKey 函数", () => {
    it("短 API Key 应完全掩码", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 8 }), (key) => {
          const masked = maskApiKey(key);
          return masked === "••••••••";
        }),
        { numRuns: 50 }
      );
    });

    it("长 API Key 应保留前4后4字符", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 12, maxLength: 100 }), (key) => {
          const masked = maskApiKey(key);
          const prefix = key.slice(0, 4);
          const suffix = key.slice(-4);
          return masked.startsWith(prefix) && masked.endsWith(suffix) && masked.includes("••••");
        }),
        { numRuns: 50 }
      );
    });

    it("空字符串应返回空字符串", () => {
      expect(maskApiKey("")).toBe("••••••••");
    });

    it("undefined 应返回空字符串", () => {
      expect(maskApiKey(undefined as unknown as string)).toBe("••••••••");
    });
  });
});
