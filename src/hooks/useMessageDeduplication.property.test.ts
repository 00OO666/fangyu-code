/**
 * Property-Based Tests for useMessageDeduplication Hook
 *
 * Feature: fangyu-code-error-fixes
 * Property 1: Message Uniqueness
 * Validates: Requirements 1.1, 1.2, 1.5
 *
 * Tests that messages with unique IDs appear exactly once in the output,
 * regardless of how many times they were received.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { ClaudeStreamMessage } from "@/types/claude";

// ============================================================================
// Message Deduplication Logic - Pure Implementation for Testing
// ============================================================================

/**
 * Extract message ID from a ClaudeStreamMessage
 */
function getMessageId(message: ClaudeStreamMessage): string | null {
  return (message as any)?.message?.id || (message as any).id || (message as any).uuid || null;
}

/**
 * Pure implementation of message deduplication logic for property testing.
 * This mirrors the useMessageDeduplication hook logic without React dependencies.
 */
function deduplicateMessages(messages: ClaudeStreamMessage[]): {
  messages: ClaudeStreamMessage[];
  originalCount: number;
  deduplicatedCount: number;
  duplicateCount: number;
  duplicateRate: number;
} {
  // Use Map for deduplication, keeping the latest version
  const messageMap = new Map<string, ClaudeStreamMessage>();

  for (const msg of messages) {
    const id = getMessageId(msg);

    if (id) {
      const existingMsg = messageMap.get(id);

      if (existingMsg && existingMsg.message?.content && msg.message?.content) {
        // Merge content arrays, preserving thinking blocks
        const existingContent = Array.isArray(existingMsg.message.content)
          ? existingMsg.message.content
          : [];
        const newContent = Array.isArray(msg.message.content) ? msg.message.content : [];

        const existingThinking = existingContent.filter((item: any) => item.type === "thinking");
        const newThinking = newContent.filter((item: any) => item.type === "thinking");

        if (existingThinking.length > 0 && newThinking.length === 0) {
          messageMap.set(id, {
            ...msg,
            message: {
              ...msg.message,
              content: [...existingThinking, ...newContent],
            },
          });
        } else {
          messageMap.set(id, msg);
        }
      } else {
        messageMap.set(id, msg);
      }
    }
  }

  // Merge results: maintain original order
  const deduplicatedMessages: ClaudeStreamMessage[] = [];
  const seenIds = new Set<string>();

  for (const msg of messages) {
    const id = getMessageId(msg);

    if (id) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        deduplicatedMessages.push(messageMap.get(id)!);
      }
    } else {
      // Messages without ID are kept as-is
      deduplicatedMessages.push(msg);
    }
  }

  const originalCount = messages.length;
  const deduplicatedCount = deduplicatedMessages.length;
  const duplicateCount = originalCount - deduplicatedCount;
  const duplicateRate = originalCount > 0 ? duplicateCount / originalCount : 0;

  return {
    messages: deduplicatedMessages,
    originalCount,
    deduplicatedCount,
    duplicateCount,
    duplicateRate,
  };
}

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

// Message type generator
const messageTypeArb = fc.constantFrom<ClaudeStreamMessage["type"]>(
  "user",
  "assistant",
  "system",
  "result",
  "thinking"
);

// Content item generator
const contentItemArb = fc.oneof(
  fc.record({
    type: fc.constant("text" as const),
    text: fc.string({ minLength: 1, maxLength: 200 }),
  }),
  fc.record({
    type: fc.constant("thinking" as const),
    thinking: fc.string({ minLength: 1, maxLength: 100 }),
  })
);

// Message with ID generator
const messageWithIdArb = fc.record({
  id: fc.uuid(),
  type: messageTypeArb,
  timestamp: fc.date().map((d) => d.toISOString()),
  message: fc.record({
    id: fc.uuid(),
    content: fc.array(contentItemArb, { minLength: 1, maxLength: 5 }),
  }),
});

// Message without ID generator
const messageWithoutIdArb = fc.record({
  type: messageTypeArb,
  timestamp: fc.date().map((d) => d.toISOString()),
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

// Array of messages with some duplicates
const messagesWithDuplicatesArb = fc
  .array(messageWithIdArb, { minLength: 1, maxLength: 20 })
  .chain((uniqueMessages) => {
    // Randomly duplicate some messages
    return fc
      .array(fc.integer({ min: 0, max: uniqueMessages.length - 1 }), {
        minLength: 0,
        maxLength: 10,
      })
      .map((duplicateIndices) => {
        const result = [...uniqueMessages];
        for (const idx of duplicateIndices) {
          // Insert duplicate at random position
          const insertPos = Math.floor(Math.random() * result.length);
          result.splice(insertPos, 0, { ...uniqueMessages[idx] });
        }
        return result as ClaudeStreamMessage[];
      });
  });

// ============================================================================
// Property Tests
// ============================================================================

describe("useMessageDeduplication - Message Uniqueness", () => {
  /**
   * Property 1: Message Uniqueness
   *
   * For any stream of messages processed by the Message_Deduplication_System,
   * each message with a unique ID SHALL appear exactly once in the output,
   * regardless of how many times it was received.
   *
   * Validates: Requirements 1.1, 1.2, 1.5
   */
  it("should ensure each message ID appears exactly once in output", async () => {
    await fc.assert(
      fc.property(messagesWithDuplicatesArb, (messages) => {
        const result = deduplicateMessages(messages);

        // Extract IDs from deduplicated messages
        const outputIds = result.messages
          .map((m) => getMessageId(m))
          .filter((id): id is string => id !== null);

        // Check uniqueness: no duplicate IDs in output
        const uniqueOutputIds = new Set(outputIds);
        expect(outputIds.length).toBe(uniqueOutputIds.size);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All unique IDs from input are preserved in output
   *
   * Validates: Requirements 1.1
   */
  it("should preserve all unique message IDs from input", async () => {
    await fc.assert(
      fc.property(messagesWithDuplicatesArb, (messages) => {
        const result = deduplicateMessages(messages);

        // Get unique IDs from input
        const inputIds = new Set(
          messages.map((m) => getMessageId(m)).filter((id): id is string => id !== null)
        );

        // Get IDs from output
        const outputIds = new Set(
          result.messages.map((m) => getMessageId(m)).filter((id): id is string => id !== null)
        );

        // All unique input IDs should be in output
        for (const id of inputIds) {
          expect(outputIds.has(id)).toBe(true);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Deduplication count is accurate
   *
   * Validates: Requirements 1.3
   */
  it("should accurately count duplicates", async () => {
    await fc.assert(
      fc.property(messagesWithDuplicatesArb, (messages) => {
        const result = deduplicateMessages(messages);

        // Verify counts
        expect(result.originalCount).toBe(messages.length);
        expect(result.deduplicatedCount).toBe(result.messages.length);
        expect(result.duplicateCount).toBe(result.originalCount - result.deduplicatedCount);

        // Verify duplicate rate calculation
        const expectedRate =
          result.originalCount > 0 ? result.duplicateCount / result.originalCount : 0;
        expect(result.duplicateRate).toBeCloseTo(expectedRate, 10);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Messages without IDs are preserved
   *
   * Validates: Requirements 1.2
   */
  it("should preserve messages without IDs", async () => {
    await fc.assert(
      fc.property(
        fc.array(messageWithoutIdArb as fc.Arbitrary<ClaudeStreamMessage>, {
          minLength: 1,
          maxLength: 10,
        }),
        (messages) => {
          const result = deduplicateMessages(messages);

          // All messages without IDs should be preserved
          expect(result.messages.length).toBe(messages.length);
          expect(result.duplicateCount).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original order is maintained for first occurrences
   *
   * Validates: Requirements 1.1
   */
  it("should maintain order of first occurrences", async () => {
    await fc.assert(
      fc.property(messagesWithDuplicatesArb, (messages) => {
        const result = deduplicateMessages(messages);

        // Get first occurrence indices from input
        const firstOccurrences = new Map<string, number>();
        messages.forEach((msg, idx) => {
          const id = getMessageId(msg);
          if (id && !firstOccurrences.has(id)) {
            firstOccurrences.set(id, idx);
          }
        });

        // Verify output order matches first occurrence order
        let lastInputIdx = -1;
        for (const msg of result.messages) {
          const id = getMessageId(msg);
          if (id) {
            const inputIdx = firstOccurrences.get(id)!;
            expect(inputIdx).toBeGreaterThan(lastInputIdx);
            lastInputIdx = inputIdx;
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Thinking blocks are preserved during merge
   *
   * Validates: Requirements 1.2 (maintain data integrity)
   */
  it("should preserve thinking blocks when merging duplicates", async () => {
    await fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (id, thinkingText, textContent) => {
          // Create message with thinking block
          const msgWithThinking: ClaudeStreamMessage = {
            id,
            type: "assistant",
            timestamp: new Date().toISOString(),
            message: {
              id,
              content: [
                { type: "thinking", thinking: thinkingText },
                { type: "text", text: "initial" },
              ],
            },
          } as any;

          // Create duplicate without thinking block (newer version)
          const msgWithoutThinking: ClaudeStreamMessage = {
            id,
            type: "assistant",
            timestamp: new Date().toISOString(),
            message: {
              id,
              content: [{ type: "text", text: textContent }],
            },
          } as any;

          const result = deduplicateMessages([msgWithThinking, msgWithoutThinking]);

          // Should have exactly one message
          expect(result.messages.length).toBe(1);

          // The merged message should have thinking block preserved
          const mergedContent = (result.messages[0] as any).message?.content;
          expect(Array.isArray(mergedContent)).toBe(true);

          const hasThinking = mergedContent.some((item: any) => item.type === "thinking");
          expect(hasThinking).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idempotency - deduplicating twice gives same result
   *
   * Validates: Requirements 1.1
   */
  it("should be idempotent - deduplicating twice gives same result", async () => {
    await fc.assert(
      fc.property(messagesWithDuplicatesArb, (messages) => {
        const firstPass = deduplicateMessages(messages);
        const secondPass = deduplicateMessages(firstPass.messages);

        // Second pass should not change anything
        expect(secondPass.messages.length).toBe(firstPass.messages.length);
        expect(secondPass.duplicateCount).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Duplicate rate is always between 0 and 1
   *
   * Validates: Requirements 1.3
   */
  it("should have duplicate rate between 0 and 1", async () => {
    await fc.assert(
      fc.property(messagesWithDuplicatesArb, (messages) => {
        const result = deduplicateMessages(messages);

        expect(result.duplicateRate).toBeGreaterThanOrEqual(0);
        expect(result.duplicateRate).toBeLessThanOrEqual(1);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
