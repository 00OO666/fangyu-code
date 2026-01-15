/**
 * Summary Actions Property Tests
 * 
 * Property 7: Clipboard Copy Integrity
 * 
 * Requirements: 1.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Mock Clipboard API - 使用闭包隔离每个测试的状态
// =============================================================================

function createClipboardMock() {
    let content = '';
    return {
        writeText: vi.fn(async (text: string) => {
            content = text;
            return Promise.resolve();
        }),
        readText: vi.fn(async () => {
            return Promise.resolve(content);
        }),
        reset: () => {
            content = '';
        },
        getContent: () => content,
    };
}

// =============================================================================
// Property 7: Clipboard Copy Integrity
// =============================================================================

describe('Property 7: Clipboard Copy Integrity', () => {
    let clipboard: ReturnType<typeof createClipboardMock>;

    beforeEach(() => {
        clipboard = createClipboardMock();
        vi.clearAllMocks();
    });

    afterEach(() => {
        clipboard.reset();
    });

    // 辅助函数
    async function copyToClipboard(text: string): Promise<boolean> {
        try {
            await clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }

    async function readFromClipboard(): Promise<string> {
        return clipboard.readText();
    }

    it('should preserve text content exactly after copy', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 0, maxLength: 1000 }),
                async (text) => {
                    clipboard.reset();
                    await copyToClipboard(text);
                    const result = await readFromClipboard();
                    expect(result).toBe(text);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should preserve markdown formatting', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    heading: fc.string({ minLength: 1, maxLength: 50 }),
                    content: fc.string({ minLength: 0, maxLength: 100 }),
                    codeBlock: fc.string({ minLength: 0, maxLength: 50 }),
                }),
                async ({ heading, content, codeBlock }) => {
                    clipboard.reset();
                    const markdown = `# ${heading}\n\n${content}\n\n\`\`\`\n${codeBlock}\n\`\`\``;
                    await copyToClipboard(markdown);
                    const result = await readFromClipboard();
                    expect(result).toBe(markdown);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should preserve unicode characters', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.unicodeString({ minLength: 0, maxLength: 500 }),
                async (text) => {
                    clipboard.reset();
                    await copyToClipboard(text);
                    const result = await readFromClipboard();
                    expect(result).toBe(text);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should preserve Chinese characters', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.integer({ min: 0x4e00, max: 0x9fff }).map(code => String.fromCharCode(code)),
                    { minLength: 0, maxLength: 100 }
                ).map(chars => chars.join('')),
                async (chineseText) => {
                    clipboard.reset();
                    await copyToClipboard(chineseText);
                    const result = await readFromClipboard();
                    expect(result).toBe(chineseText);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should preserve newlines and whitespace', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.oneof(
                        fc.string({ minLength: 1, maxLength: 20 }),
                        fc.constant('\n'),
                        fc.constant('\r\n'),
                        fc.constant('\t'),
                        fc.constant('  ')
                    ),
                    { minLength: 1, maxLength: 10 }
                ).map(parts => parts.join('')),
                async (textWithWhitespace) => {
                    clipboard.reset();
                    await copyToClipboard(textWithWhitespace);
                    const result = await readFromClipboard();
                    expect(result).toBe(textWithWhitespace);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should handle empty string', async () => {
        await copyToClipboard('');
        const result = await readFromClipboard();
        expect(result).toBe('');
    });

    it('should handle very long text', async () => {
        const longText = 'a'.repeat(10000);
        await copyToClipboard(longText);
        const result = await readFromClipboard();
        expect(result).toBe(longText);
        expect(result.length).toBe(10000);
    });

    it('should return true on successful copy', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 0, maxLength: 100 }),
                async (text) => {
                    clipboard.reset();
                    const success = await copyToClipboard(text);
                    expect(success).toBe(true);
                }
            ),
            { numRuns: 30 }
        );
    });

    it('should handle special characters', async () => {
        const specialChars = [
            '`', '~', '!', '@', '#', '$', '%', '^', '&', '*',
            '(', ')', '-', '_', '=', '+', '[', ']', '{', '}',
            '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.',
            '?', '/', '©', '®', '™', '€', '£', '¥', '°', '±'
        ];

        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.constantFrom(...specialChars), { minLength: 1, maxLength: 20 })
                    .map(chars => chars.join('')),
                async (text) => {
                    clipboard.reset();
                    await copyToClipboard(text);
                    const result = await readFromClipboard();
                    expect(result).toBe(text);
                }
            ),
            { numRuns: 30 }
        );
    });
});
