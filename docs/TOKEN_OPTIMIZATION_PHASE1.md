# Token Optimization Phase 1 - Integration Guide

## Overview

Phase 1 implements foundational token optimization services that can reduce token usage by 30-40%. This guide explains how to integrate these services into Fangyu Code.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Feature Flags                            │
│  (src/config/featureFlags.ts)                               │
│  - LAZY_HISTORY_LOADING                                     │
│  - SELECTIVE_MCP_CONTEXT                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Optimization Services                           │
├─────────────────────────────────────────────────────────────┤
│  Message Context Optimizer                                   │
│  (src/services/messageContextOptimizer.ts)                  │
│  - Limits message history to last 50 messages               │
│  - Calculates optimal window size                           │
│  - Estimates token savings                                  │
├─────────────────────────────────────────────────────────────┤
│  MCP Context Manager                                         │
│  (src/services/mcpContextManager.ts)                       │
│  - Filters MCP servers by usage                             │
│  - Always/Lazy/OnDemand loading strategies                  │
│  - Tracks MCP context overhead                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Integration Hook                                   │
│  (src/hooks/useTokenOptimization.ts)                        │
│  - optimizeMessages()                                        │
│  - optimizeMCPServers()                                     │
│  - getStats()                                               │
└─────────────────────────────────────────────────────────────┘
```

## Services

### 1. Feature Flags (`src/config/featureFlags.ts`)

Controls which optimizations are enabled:

```typescript
import { isFeatureEnabled, enableFeature, disableFeature } from '@/config/featureFlags';

// Check if optimization is enabled
if (isFeatureEnabled('LAZY_HISTORY_LOADING')) {
  // Apply optimization
}

// Enable/disable features at runtime
enableFeature('SELECTIVE_MCP_CONTEXT');
disableFeature('LAZY_HISTORY_LOADING');
```

**Available Flags:**
- `LAZY_HISTORY_LOADING` - Limit message history (Phase 1) ✅
- `SELECTIVE_MCP_CONTEXT` - Filter MCP servers (Phase 1) ✅
- `CONTEXT_WINDOW_PRUNING` - Summarize old messages (Phase 2)
- `VIRTUAL_SCROLLING` - Virtual list rendering (Phase 2)
- `TOOL_RESULT_COMPRESSION` - Compress tool outputs (Phase 2)

### 2. Message Context Optimizer (`src/services/messageContextOptimizer.ts`)

Reduces token usage by limiting message history:

```typescript
import { getOptimizedMessageContext } from '@/services/messageContextOptimizer';

const result = getOptimizedMessageContext(allMessages, 50);
// result.messages - Optimized message array (last 50)
// result.excludedCount - Number of messages excluded
// result.estimatedTokensSaved - Estimated tokens saved
```

**Key Functions:**
- `getOptimizedMessageContext()` - Get optimized message window
- `calculateOptimalWindowSize()` - Calculate dynamic window size
- `getOptimizationStats()` - Get optimization statistics

### 3. MCP Context Manager (`src/services/mcpContextManager.ts`)

Reduces token usage by selectively loading MCP contexts:

```typescript
import { filterMCPServers, shouldLoadMCPContext } from '@/services/mcpContextManager';

// Filter servers based on usage
const activeServers = filterMCPServers(
  ['github', 'filesystem', 'puppeteer', 'context7'],
  recentMessages,
  currentPrompt
);
// Returns: ['github', 'filesystem'] (only needed servers)

// Check individual server
if (shouldLoadMCPContext('puppeteer', recentMessages, currentPrompt)) {
  // Load puppeteer context
}
```

**Loading Strategies:**
- **Always Load**: Core tools (github, filesystem) - always included
- **Lazy Load**: Load if mentioned in last 3 messages (context7, sequential-thinking)
- **On Demand**: Load only on explicit @mention (puppeteer, chrome-devtools, fetch, memory)

### 4. Integration Hook (`src/hooks/useTokenOptimization.ts`)

Convenient hook for using optimization services:

```typescript
import { useTokenOptimization } from '@/hooks/useTokenOptimization';

function MyComponent() {
  const { optimizeMessages, optimizeMCPServers, getStats } = useTokenOptimization();

  // Optimize messages before API call
  const { messages: optimizedMessages } = optimizeMessages(allMessages);

  // Filter MCP servers
  const activeServers = optimizeMCPServers(
    availableServers,
    messageHistory,
    currentPrompt
  );

  // Get statistics
  const stats = getStats();
  console.log(`Saved ${stats.totalTokensSaved} tokens`);
}
```

## Integration Steps

### Step 1: Integrate Message Optimization

**File**: `src/hooks/usePromptExecution.ts` or wherever messages are prepared for API

```typescript
import { useTokenOptimization } from '@/hooks/useTokenOptimization';

export function usePromptExecution(config: UsePromptExecutionConfig) {
  const { optimizeMessages } = useTokenOptimization();

  const executePrompt = useCallback(async (prompt: string) => {
    // Get all messages
    const allMessages = messages;

    // ✅ OPTIMIZATION: Limit message history
    const { messages: optimizedMessages } = optimizeMessages(allMessages);

    // Send optimized messages to API instead of all messages
    await api.sendPrompt({
      messages: optimizedMessages, // ← Use optimized messages
      prompt,
      // ... other params
    });
  }, [messages, optimizeMessages]);

  return { executePrompt };
}
```

### Step 2: Integrate MCP Context Filtering

**File**: Where MCP servers are loaded (likely in `src/lib/api.ts` or MCP initialization)

```typescript
import { useTokenOptimization } from '@/hooks/useTokenOptimization';

export function useMCPInitialization() {
  const { optimizeMCPServers } = useTokenOptimization();

  const loadMCPContexts = useCallback(async (
    availableServers: string[],
    messages: Message[],
    currentPrompt: string
  ) => {
    // ✅ OPTIMIZATION: Filter MCP servers
    const activeServers = optimizeMCPServers(
      availableServers,
      messages,
      currentPrompt
    );

    // Only load contexts for active servers
    const contexts = await Promise.all(
      activeServers.map(server => loadMCPContext(server))
    );

    return contexts;
  }, [optimizeMCPServers]);

  return { loadMCPContexts };
}
```

### Step 3: Display Optimization Statistics

**File**: `src/components/UsageDashboard.tsx` or create new component

```typescript
import { useTokenOptimization } from '@/hooks/useTokenOptimization';

export function TokenOptimizationStats() {
  const { getStats, isOptimizationEnabled } = useTokenOptimization();
  const stats = getStats();

  if (!isOptimizationEnabled) {
    return <div>Token optimization disabled</div>;
  }

  return (
    <div className="token-optimization-stats">
      <h3>Token Optimization</h3>
      <div>
        <span>Tokens Saved:</span>
        <span>{stats.totalTokensSaved.toLocaleString()}</span>
      </div>
      <div>
        <span>Messages Excluded:</span>
        <span>{stats.messagesExcluded}</span>
      </div>
      <div>
        <span>MCP Servers Excluded:</span>
        <span>{stats.mcpServersExcluded}</span>
      </div>
    </div>
  );
}
```

## Testing

### Manual Testing

1. **Enable optimizations**:
   ```javascript
   // In browser console (F12)
   localStorage.setItem('feature_LAZY_HISTORY_LOADING', 'true');
   localStorage.setItem('feature_SELECTIVE_MCP_CONTEXT', 'true');
   ```

2. **Test message optimization**:
   - Create a session with 100+ messages
   - Send a new prompt
   - Check console for: `[MessageContextOptimizer] Optimized context: 100 → 50 messages`

3. **Test MCP filtering**:
   - Have multiple MCP servers configured
   - Send a prompt without mentioning specific tools
   - Check console for: `[MCPContextManager] Excluded N servers`

4. **Verify token savings**:
   - Compare session costs before/after optimization
   - Check UsageDashboard for savings statistics

### Feature Flag Testing

```javascript
// Test with optimization enabled
localStorage.setItem('feature_LAZY_HISTORY_LOADING', 'true');
// Send prompts, check token usage

// Test with optimization disabled
localStorage.setItem('feature_LAZY_HISTORY_LOADING', 'false');
// Send prompts, verify no optimization applied

// Reset to default
localStorage.removeItem('feature_LAZY_HISTORY_LOADING');
```

## Expected Results

### Phase 1 Targets

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Avg tokens/session | 3500 | 2200-2500 | 30-40% |
| Messages in context | All (100+) | Last 50 | 50% |
| MCP servers loaded | All (5-10) | 2-4 active | 50-70% |
| Context size (KB) | 150 | 100 | 33% |

### Console Output Examples

```
[MessageContextOptimizer] Optimized context: 120 → 50 messages
[MessageContextOptimizer] Excluded 70 old messages, saved ~35000 tokens

[MCPContextManager] Excluded 3 servers: puppeteer, chrome-devtools, fetch
[MCPContextManager] Included 2 servers: github, filesystem
[MCPContextManager] Estimated tokens saved: 600 (60.0%)

[TokenOptimization] Total tokens saved this session: 35600
```

## Troubleshooting

### Issue: Optimization not working

**Check:**
1. Feature flags enabled: `localStorage.getItem('feature_LAZY_HISTORY_LOADING')`
2. Console logs present: Look for `[MessageContextOptimizer]` or `[MCPContextManager]`
3. Services imported correctly: Check import paths

### Issue: Too aggressive optimization

**Solution:**
Adjust window size:
```typescript
// Increase from default 50 to 100
const { messages } = optimizeMessages(allMessages, 100);
```

Or modify `DEFAULT_WINDOW_SIZE` in `messageContextOptimizer.ts`

### Issue: MCP tools not available

**Solution:**
Add to `alwaysLoad` list:
```typescript
// In mcpContextManager.ts
const DEFAULT_CONFIG: MCPContextConfig = {
  alwaysLoad: ["github", "filesystem", "your-tool"],
  // ...
};
```

## Next Steps (Phase 2)

1. **Context Window Pruning**: Summarize messages 11-50 (70% compression)
2. **Tool Result Compression**: Compress large file reads
3. **Virtual Scrolling**: Already implemented in SessionMessages.tsx
4. **Performance Monitoring**: Add real-time metrics dashboard

## Files Modified

- ✅ `src/config/featureFlags.ts` - Feature flag system
- ✅ `src/services/mcpContextManager.ts` - MCP context filtering
- ✅ `src/services/messageContextOptimizer.ts` - Message history optimization
- ✅ `src/hooks/useTokenOptimization.ts` - Integration hook
- ✅ `package.json`, `tauri.conf.json`, `Cargo.toml` - Version 2.2.0
- ✅ `src/hooks/useFirstLaunchChangelog.ts` - Changelog updated

## Support

For questions or issues:
1. Check console logs for optimization messages
2. Verify feature flags in localStorage
3. Review this integration guide
4. Test with feature flags disabled to isolate issues
