/**
 * Tests for command parser
 */

import { describe, it, expect } from 'vitest';
import { parseCommand, isCommand, extractArgs } from '../utils/commands';

describe('Command Parser', () => {
  describe('parseCommand', () => {
    it('should parse simple commands', () => {
      const result = parseCommand('!today');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('today');
      expect(result?.args).toEqual([]);
    });

    it('should parse commands with arguments', () => {
      const result = parseCommand('!log algebra 45');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('log');
      expect(result?.args).toEqual(['algebra', '45']);
    });

    it('should return null for non-commands', () => {
      const result = parseCommand('hello world');
      expect(result).toBeNull();
    });

    it('should handle case insensitivity', () => {
      const result = parseCommand('!HELP');
      expect(result?.command).toBe('help');
    });

    it('should handle multiple spaces', () => {
      const result = parseCommand('!add  goal  Math Exam');
      expect(result?.command).toBe('add');
      expect(result?.args).toEqual(['goal', 'Math', 'Exam']);
    });
  });

  describe('isCommand', () => {
    it('should return true for commands', () => {
      expect(isCommand('!today')).toBe(true);
      expect(isCommand('!goals')).toBe(true);
    });

    it('should return false for non-commands', () => {
      expect(isCommand('hello')).toBe(false);
      expect(isCommand('today')).toBe(false);
    });
  });

  describe('extractArgs', () => {
    it('should extract arguments successfully', () => {
      const result = extractArgs('!log algebra 45');
      expect(result.success).toBe(true);
      expect(result.args).toEqual(['algebra', '45']);
    });

    it('should validate minimum arguments', () => {
      const result = extractArgs('!log', 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('should validate maximum arguments', () => {
      const result = extractArgs('!log a b c d', undefined, 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain('at most');
    });
  });
});

