# Session Cost Calculation Comparison

## Any-Code vs Fangyu Code

### Key Differences

| Feature | Any-Code | Fangyu Code (Current) | Recommendation |
|---------|----------|----------------------|----------------|
| **Message Deduplication** | ❌ No (only eventMap) | ✅ Yes (lines 62-93) | ❌ Remove (causes issues) |
| **Debug Logging** | ❌ No | ✅ Yes (extensive) | ❌ Remove (noise) |
| **cost_usd Priority** | ❌ No | ✅ Yes (lines 149-160) | ✅ Keep (more accurate) |
| **Session Default Model** | ❌ No | ✅ Yes (lines 99-106) | ✅ Keep (more accurate) |
| **getBillingKey** | Simple | Complex with warnings | Use Any-Code's simpler version |
| **getModelName** | Simple | Complex with session model | Keep Fangyu Code's version |

### Root Cause Analysis

**Why costs were decreasing:**

The message-level deduplication (lines 62-93) was replacing messages in-place:
```typescript
if (existingIndex !== undefined) {
  deduplicatedMessages[existingIndex] = msg; // REPLACES at original position
}
```

This could cause issues when:
1. A message is updated multiple times during streaming
2. The replacement logic interferes with the eventMap deduplication
3. Messages are processed out of order

**Solution:**

Use Any-Code's simpler approach:
- Remove message-level deduplication
- Rely only on eventMap-based deduplication (which both versions have)
- Keep cost_usd prioritization for accuracy
- Keep session default model for accuracy

### Implementation Plan

1. Replace `aggregateSessionCost()` with Any-Code's simpler version
2. Keep cost_usd prioritization logic
3. Keep session default model extraction
4. Remove all debug logging
5. Simplify getBillingKey (no warnings)
6. Test to ensure costs increase correctly during conversation
