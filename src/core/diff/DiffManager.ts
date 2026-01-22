/**
 * Diff Manager
 * 管理代码差异的解析和应用
 */

import { logger } from '@/lib/logger';

export interface DiffChange {
  id: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export class DiffManager {
  private changes: Map<string, DiffChange> = new Map();

  parseDiff(aiResponse: string): DiffChange[] {
    const changes: DiffChange[] = [];
    const lines = aiResponse.split('\n');
    let currentFile = '';
    let oldContent = '';
    let newContent = '';
    let inDiff = false;

    for (const line of lines) {
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        if (inDiff && currentFile) {
          const id = `${currentFile}-${Date.now()}-${Math.random()}`;
          const change: DiffChange = {
            id,
            filePath: currentFile,
            oldContent,
            newContent,
            status: 'pending',
          };
          changes.push(change);
          this.changes.set(id, change);
          oldContent = '';
          newContent = '';
        }
        currentFile = line.substring(4).trim();
        inDiff = true;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        oldContent += line.substring(1) + '\n';
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        newContent += line.substring(1) + '\n';
      }
    }

    if (inDiff && currentFile) {
      const id = `${currentFile}-${Date.now()}-${Math.random()}`;
      const change: DiffChange = {
        id,
        filePath: currentFile,
        oldContent,
        newContent,
        status: 'pending',
      };
      changes.push(change);
      this.changes.set(id, change);
    }

    return changes;
  }

  acceptChange(changeId: string): void {
    const change = this.changes.get(changeId);
    if (change) {
      change.status = 'accepted';
    }
  }

  rejectChange(changeId: string): void {
    const change = this.changes.get(changeId);
    if (change) {
      change.status = 'rejected';
    }
  }

  async applyChanges(): Promise<void> {
    for (const change of this.changes.values()) {
      if (change.status === 'accepted') {
        // In a real implementation, this would write to files
        // For now, we just mark as applied
        logger.debug('DiffManager', `Applying change to ${change.filePath}`);
      }
    }
  }

  getChanges(): DiffChange[] {
    return Array.from(this.changes.values());
  }

  getChange(id: string): DiffChange | undefined {
    return this.changes.get(id);
  }

  clearChanges(): void {
    this.changes.clear();
  }
}

export default DiffManager;
