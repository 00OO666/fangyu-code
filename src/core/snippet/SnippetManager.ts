/**
 * Snippet Manager
 * 代码片段管理器
 */

export interface Snippet {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SnippetManager {
  private snippets: Map<string, Snippet> = new Map();

  addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Snippet {
    const id = `snippet-${Date.now()}-${Math.random()}`;
    const now = new Date();
    const newSnippet: Snippet = {
      ...snippet,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.snippets.set(id, newSnippet);
    return newSnippet;
  }

  getSnippet(id: string): Snippet | undefined {
    return this.snippets.get(id);
  }

  getAllSnippets(): Snippet[] {
    return Array.from(this.snippets.values());
  }

  updateSnippet(id: string, updates: Partial<Omit<Snippet, 'id' | 'createdAt'>>): Snippet | null {
    const snippet = this.snippets.get(id);
    if (!snippet) return null;

    const updated: Snippet = {
      ...snippet,
      ...updates,
      updatedAt: new Date(),
    };
    this.snippets.set(id, updated);
    return updated;
  }

  deleteSnippet(id: string): boolean {
    return this.snippets.delete(id);
  }

  searchSnippets(query: string): Snippet[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSnippets().filter(
      (snippet) =>
        snippet.name.toLowerCase().includes(lowerQuery) ||
        snippet.description.toLowerCase().includes(lowerQuery) ||
        snippet.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getSnippetsByLanguage(language: string): Snippet[] {
    return this.getAllSnippets().filter((snippet) => snippet.language === language);
  }

  getSnippetsByTag(tag: string): Snippet[] {
    return this.getAllSnippets().filter((snippet) => snippet.tags.includes(tag));
  }

  clearAll(): void {
    this.snippets.clear();
  }
}

export default SnippetManager;
