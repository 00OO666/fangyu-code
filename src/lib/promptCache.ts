/**
 * Intelligent Prompt Cache System
 *
 * Advanced LRU-based caching system with intelligent features:
 * - Semantic similarity detection
 * - Prompt pattern recognition
 * - Context-aware caching
 * - Performance analytics
 */

import { ClaudeMessage, ClaudeResponse } from './claudeSDK';


export interface CacheEntry {
  id: string;
  promptHash: string;
  prompt: string;
  messages: ClaudeMessage[];
  response: ClaudeResponse;
  metadata: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens?: number;
  };
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  similarity?: number; // For fuzzy matches
  tags: string[];
}

export interface CacheConfig {
  maxSize: number;
  ttlMs: number; // Time to live in milliseconds
  enableSemanticSimilarity: boolean;
  similarityThreshold: number; // 0-1, higher means stricter matching
  enableFuzzyMatching: boolean;
  persistToDisk: boolean;
  analyticsEnabled: boolean;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalTokensSaved: number;
  totalCostSaved: number; // In USD
  averageResponseTime: number;
  cacheSize: number; // In bytes
  oldestEntry?: number;
  newestEntry?: number;
}

export interface CacheAnalytics {
  dailyStats: Record<string, { hits: number; misses: number; tokensSaved: number }>;
  popularPatterns: Array<{ pattern: string; frequency: number; tokensSaved: number }>;
  modelUsage: Record<string, { requests: number; cacheHits: number }>;
  performanceGains: {
    averageResponseTimeReduction: number;
    tokenCostSavings: number;
    requestSpeedUp: number;
  };
}

export class IntelligentPromptCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // For LRU tracking
  private stats: CacheStats;
  private config: CacheConfig;
  private analytics: CacheAnalytics;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      ttlMs: 24 * 60 * 60 * 1000, // 24 hours
      enableSemanticSimilarity: true,
      similarityThreshold: 0.85,
      enableFuzzyMatching: true,
      persistToDisk: true,
      analyticsEnabled: true,
      ...config,
    };

    this.stats = {
      totalEntries: 0,
      hitRate: 0,
      totalHits: 0,
      totalMisses: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      averageResponseTime: 0,
      cacheSize: 0,
    };

    this.analytics = {
      dailyStats: {},
      popularPatterns: [],
      modelUsage: {},
      performanceGains: {
        averageResponseTimeReduction: 0,
        tokenCostSavings: 0,
        requestSpeedUp: 0,
      },
    };

    this.loadFromStorage();
  }

  /**
   * Generate cache key from prompt and context
   */
  private generateCacheKey(
    messages: ClaudeMessage[],
    model: string,
    temperature: number,
    systemPrompt?: string
  ): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    const context = `${model}:${temperature}:${systemPrompt || ''}`;
    return this.hashString(`${content}:${context}`);
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calculate semantic similarity between two prompts
   */
  private calculateSimilarity(prompt1: string, prompt2: string): number {
    if (!this.config.enableSemanticSimilarity) return 0;

    // Simple similarity based on word overlap and structure
    const words1 = new Set(prompt1.toLowerCase().split(/\W+/));
    const words2 = new Set(prompt2.toLowerCase().split(/\W+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    const jaccardSimilarity = intersection.size / union.size;

    // Boost similarity for similar structure
    const lengthSimilarity = 1 - Math.abs(prompt1.length - prompt2.length) / Math.max(prompt1.length, prompt2.length);

    return (jaccardSimilarity * 0.7) + (lengthSimilarity * 0.3);
  }

  /**
   * Find similar cached entry
   */
  private findSimilarEntry(
    messages: ClaudeMessage[],
    model: string,
    temperature: number,
    systemPrompt?: string
  ): CacheEntry | null {
    if (!this.config.enableFuzzyMatching) return null;

    const currentPrompt = messages.map(m => m.content).join(' ');
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.cache.values()) {
      // Only consider entries with same model and similar temperature
      if (entry.metadata.model !== model || Math.abs(entry.metadata.temperature - temperature) > 0.1) {
        continue;
      }

      // Skip if system prompt is different
      if (entry.metadata.systemPrompt !== systemPrompt) {
        continue;
      }

      const entryPrompt = entry.messages.map(m => m.content).join(' ');
      const similarity = this.calculateSimilarity(currentPrompt, entryPrompt);

      if (similarity > this.config.similarityThreshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { ...entry, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Extract tags from prompt for categorization
   */
  private extractTags(messages: ClaudeMessage[]): string[] {
    const content = messages.map(m => m.content).join(' ').toLowerCase();
    const tags: string[] = [];

    // Programming related
    if (/\b(code|function|class|import|export|async|await)\b/.test(content)) {
      tags.push('programming');
    }

    // Translation related
    if (/\b(translate|translation|翻译|语言)\b/.test(content)) {
      tags.push('translation');
    }

    // Writing related
    if (/\b(write|essay|article|document|text)\b/.test(content)) {
      tags.push('writing');
    }

    // Analysis related
    if (/\b(analyze|analysis|compare|evaluate|review)\b/.test(content)) {
      tags.push('analysis');
    }

    // Question/Answer
    if (/\b(what|how|why|when|where|explain|describe)\b/.test(content)) {
      tags.push('question');
    }

    return tags;
  }

  /**
   * Update LRU order
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    while (this.cache.size >= this.config.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey && this.cache.has(oldestKey)) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }

  /**
   * Update analytics
   */
  private updateAnalytics(isHit: boolean, tokensSaved: number = 0): void {
    if (!this.config.analyticsEnabled) return;

    const today = new Date().toISOString().split('T')[0];

    if (!this.analytics.dailyStats[today]) {
      this.analytics.dailyStats[today] = { hits: 0, misses: 0, tokensSaved: 0 };
    }

    if (isHit) {
      this.stats.totalHits++;
      this.analytics.dailyStats[today].hits++;
      this.stats.totalTokensSaved += tokensSaved;
      this.analytics.dailyStats[today].tokensSaved += tokensSaved;

      // Estimate cost savings (rough estimate: $0.003 per 1k tokens for input)
      this.stats.totalCostSaved += (tokensSaved / 1000) * 0.003;
    } else {
      this.stats.totalMisses++;
      this.analytics.dailyStats[today].misses++;
    }

    this.stats.hitRate = this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses);
  }

  /**
   * Get cached response
   */
  async get(
    messages: ClaudeMessage[],
    model: string,
    temperature: number,
    systemPrompt?: string
  ): Promise<CacheEntry | null> {
    this.cleanExpired();

    const key = this.generateCacheKey(messages, model, temperature, systemPrompt);
    let entry = this.cache.get(key);

    // If exact match not found, try fuzzy matching
    if (!entry) {
      entry = this.findSimilarEntry(messages, model, temperature, systemPrompt) || undefined;
    }

    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      this.updateAccessOrder(key);
      this.updateAnalytics(true, entry.usage.input_tokens + entry.usage.output_tokens);

      
      return entry;
    }

    this.updateAnalytics(false);
    
    return null;
  }

  /**
   * Store response in cache
   */
  async set(
    messages: ClaudeMessage[],
    response: ClaudeResponse,
    model: string,
    temperature: number,
    maxTokens: number,
    systemPrompt?: string
  ): Promise<void> {
    const key = this.generateCacheKey(messages, model, temperature, systemPrompt);
    const now = Date.now();

    const entry: CacheEntry = {
      id: key,
      promptHash: key,
      prompt: messages.map(m => m.content).join(' '),
      messages,
      response,
      metadata: {
        model,
        temperature,
        maxTokens,
        systemPrompt,
      },
      usage: response.usage,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      tags: this.extractTags(messages),
    };

    this.evictLRU();
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.totalEntries = this.cache.size;

    if (this.config.persistToDisk) {
      this.saveToStorage();
    }

    
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());

    return {
      ...this.stats,
      totalEntries: this.cache.size,
      cacheSize: JSON.stringify(Array.from(this.cache.entries())).length,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : undefined,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : undefined,
    };
  }

  /**
   * Get detailed analytics
   */
  getAnalytics(): CacheAnalytics {
    return { ...this.analytics };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.totalEntries = 0;

    if (this.config.persistToDisk) {
      this.saveToStorage();
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // If size limit reduced, evict entries
    if (newConfig.maxSize && newConfig.maxSize < this.cache.size) {
      this.evictLRU();
    }
  }

  /**
   * Get cache entries by tag
   */
  getEntriesByTag(tag: string): CacheEntry[] {
    return Array.from(this.cache.values()).filter(entry => entry.tags.includes(tag));
  }

  /**
   * Get most popular cached patterns
   */
  getPopularPatterns(limit: number = 10): Array<{ pattern: string; frequency: number; tokensSaved: number }> {
    const patterns = new Map<string, { frequency: number; tokensSaved: number }>();

    for (const entry of this.cache.values()) {
      // Extract pattern from first 50 chars of prompt
      const pattern = entry.prompt.slice(0, 50).trim() + '...';
      const existing = patterns.get(pattern) || { frequency: 0, tokensSaved: 0 };

      patterns.set(pattern, {
        frequency: existing.frequency + entry.accessCount,
        tokensSaved: existing.tokensSaved + (entry.usage.input_tokens + entry.usage.output_tokens) * entry.accessCount,
      });
    }

    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({ pattern, ...data }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheData = {
        entries: Array.from(this.cache.entries()),
        stats: this.stats,
        analytics: this.analytics,
        config: this.config,
      };

      localStorage.setItem('claude-prompt-cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[PromptCache] Failed to save to storage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('claude-prompt-cache');
      if (!stored) return;

      const cacheData = JSON.parse(stored);

      // Restore cache entries
      this.cache = new Map(cacheData.entries || []);
      this.accessOrder = Array.from(this.cache.keys());

      // Restore stats and analytics
      this.stats = { ...this.stats, ...cacheData.stats };
      this.analytics = { ...this.analytics, ...cacheData.analytics };

      // Clean expired entries
      this.cleanExpired();
    } catch (error) {
      console.warn('[PromptCache] Failed to load from storage:', error);
    }
  }
}

// Export singleton instance
export const promptCache = new IntelligentPromptCache({
  maxSize: 1000,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  enableSemanticSimilarity: true,
  similarityThreshold: 0.85,
  enableFuzzyMatching: true,
  persistToDisk: true,
  analyticsEnabled: true,
});
