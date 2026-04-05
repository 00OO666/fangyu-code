/**
 * PreciseFileOps Property Tests
 * 
 * Property 23-25: Precise file operations
 * Validates: Requirements 15.1, 15.2, 15.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PreciseFileOps, MockFileSystem } from './PreciseFileOps';
import type { FileEncoding } from '../types/unified-agent';

// Generators
const filePathArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
  fc.constantFrom('.ts', '.js', '.py', '.txt')
).map(([name, ext]) => name + ext);

const uniqueStringArb = fc.string({ minLength: 5, maxLength: 30 })
  .filter(s => !s.includes('\n') && !s.includes('\r') && s.trim().length > 0);

const lineEndingArb = fc.constantFrom<'lf' | 'crlf'>('lf', 'crlf');

describe('PreciseFileOps Property Tests', () => {
  describe('Property 23: strReplace unique match', () => {
    it('Property 23.1: unique match should succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          async (path, oldStr, newStr) => {
            if (oldStr === newStr) return;
            
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            const content = 'prefix\n' + oldStr + '\nsuffix';
            testFs.setFile(path, content);
            
            const result = await testOps.strReplace({ path, oldStr, newStr });
            
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(1);
            
            const newContent = testFs.getFile(path);
            expect(newContent).toBeDefined();
            expect(newContent ?? '').toContain(newStr);
            expect(newContent ?? '').not.toContain(oldStr);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 23.2: zero matches should fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          async (path, searchStr, replaceStr) => {
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            const content = 'some content without the search string';
            testFs.setFile(path, content);
            
            if (content.includes(searchStr)) return;
            
            const result = await testOps.strReplace({ 
              path, 
              oldStr: searchStr, 
              newStr: replaceStr 
            });
            
            expect(result.success).toBe(false);
            expect(result.matchCount).toBe(0);
            expect(result.error).toContain('No matches');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 23.3: multiple matches should fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          fc.integer({ min: 2, max: 5 }),
          async (path, oldStr, newStr, repeatCount) => {
            if (oldStr === newStr) return;
            
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            const content = Array(repeatCount).fill(oldStr).join('\n');
            testFs.setFile(path, content);
            
            const result = await testOps.strReplace({ path, oldStr, newStr });
            
            expect(result.success).toBe(false);
            expect(result.matchCount).toBe(repeatCount);
            expect(result.error).toContain('Multiple matches');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: strReplace precise replacement', () => {
    it('Property 24.1: only matched part should be modified', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          uniqueStringArb,
          uniqueStringArb,
          async (path, prefix, oldStr, newStr, suffix) => {
            if (oldStr === newStr) return;
            if (prefix.includes(oldStr) || suffix.includes(oldStr)) return;
            
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            const content = prefix + oldStr + suffix;
            testFs.setFile(path, content);
            
            await testOps.strReplace({ path, oldStr, newStr });
            
            const newContent = testFs.getFile(path);
            
            expect(newContent).toContain(prefix);
            expect(newContent).toContain(suffix);
            expect(newContent).toBe(prefix + newStr + suffix);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 24.2: file length change should be correct', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          async (path, oldStr, newStr) => {
            if (oldStr === newStr) return;
            
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            const content = 'start_' + oldStr + '_end';
            testFs.setFile(path, content);
            
            const originalLength = content.length;
            await testOps.strReplace({ path, oldStr, newStr });
            
            const newContent = testFs.getFile(path);
            const expectedLength = originalLength - oldStr.length + newStr.length;
            
            expect(newContent).toBeDefined();
            expect((newContent ?? '').length).toBe(expectedLength);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 25: file encoding preservation', () => {
    it('Property 25.1: LF line ending should be preserved', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          async (path, oldStr, newStr) => {
            if (oldStr === newStr) return;
            
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            testFs.setEncoding(path, { encoding: 'utf-8', bom: false, lineEnding: 'lf' });
            
            const content = 'line1\n' + oldStr + '\nline3';
            testFs.setFile(path, content);
            
            await testOps.strReplace({ path, oldStr, newStr });
            
            const newContent = testFs.getFile(path);
            
            expect(newContent).not.toContain('\r\n');
            expect(newContent).toContain('\n');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 25.2: CRLF line ending should be preserved', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          uniqueStringArb,
          uniqueStringArb,
          async (path, oldStr, newStr) => {
            if (oldStr === newStr) return;
            
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            testFs.setEncoding(path, { encoding: 'utf-8', bom: false, lineEnding: 'crlf' });
            
            const content = 'line1\n' + oldStr + '\nline3';
            testFs.setFile(path, content);
            
            await testOps.strReplace({ path, oldStr, newStr });
            
            const newContent = testFs.getFile(path);
            
            expect(newContent).toContain('\r\n');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 25.3: encoding detection consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          lineEndingArb,
          async (path, lineEnding) => {
            const testFs = new MockFileSystem();
            const testOps = new PreciseFileOps(testFs);
            
            const encoding: FileEncoding = { encoding: 'utf-8', bom: false, lineEnding };
            testFs.setEncoding(path, encoding);
            testFs.setFile(path, 'test content');
            
            const detected = await testOps.detectEncoding(path);
            
            expect(detected.lineEnding).toBe(lineEnding);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('empty oldStr should fail', async () => {
      const testFs = new MockFileSystem();
      const testOps = new PreciseFileOps(testFs);
      
      testFs.setFile('test.ts', 'some content');
      
      const result = await testOps.strReplace({
        path: 'test.ts',
        oldStr: '',
        newStr: 'replacement'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('identical oldStr and newStr should fail', async () => {
      const testFs = new MockFileSystem();
      const testOps = new PreciseFileOps(testFs);
      
      testFs.setFile('test.ts', 'some content');
      
      const result = await testOps.strReplace({
        path: 'test.ts',
        oldStr: 'same',
        newStr: 'same'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('identical');
    });

    it('non-existent file should fail', async () => {
      const testFs = new MockFileSystem();
      const testOps = new PreciseFileOps(testFs);
      
      const result = await testOps.strReplace({
        path: 'nonexistent.ts',
        oldStr: 'old',
        newStr: 'new'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
