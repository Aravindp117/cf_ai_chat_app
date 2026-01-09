/**
 * Tests for memory utility functions
 */

import { describe, it, expect } from 'vitest';
import { getDecayColor, getNextReviewDate, getUrgencyScore, isDueForReview } from '../utils/memory';
import { Topic } from '../types';

describe('Memory Utilities', () => {
  describe('getDecayColor', () => {
    it('should return green for recent reviews (< 3 days)', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(getDecayColor(yesterday.toISOString())).toBe('green');
    });

    it('should return yellow for 3-7 days', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      expect(getDecayColor(fiveDaysAgo.toISOString())).toBe('yellow');
    });

    it('should return orange for 7-14 days', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      expect(getDecayColor(tenDaysAgo.toISOString())).toBe('orange');
    });

    it('should return red for > 14 days', () => {
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      expect(getDecayColor(twentyDaysAgo.toISOString())).toBe('red');
    });

    it('should return red for never reviewed', () => {
      expect(getDecayColor(null)).toBe('red');
    });
  });

  describe('getNextReviewDate', () => {
    it('should calculate next review date based on review count', () => {
      const lastReview = new Date('2024-01-01');
      const nextReview = getNextReviewDate(lastReview.toISOString(), 0);
      expect(nextReview).toBeTruthy();
      if (nextReview) {
        const nextDate = new Date(nextReview);
        expect(nextDate.getTime()).toBeGreaterThan(lastReview.getTime());
      }
    });

    it('should return null for never reviewed', () => {
      expect(getNextReviewDate(null, 0)).toBeNull();
    });
  });

  describe('getUrgencyScore', () => {
    it('should return higher score for red decay topics', () => {
      const redTopic: Topic = {
        id: '1',
        goalId: '1',
        name: 'Test',
        lastReviewed: null,
        reviewCount: 0,
        masteryLevel: 50,
        notes: '',
      };
      const score = getUrgencyScore(redTopic);
      expect(score).toBeGreaterThan(50);
    });

    it('should return lower score for green decay topics', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const greenTopic: Topic = {
        id: '1',
        goalId: '1',
        name: 'Test',
        lastReviewed: yesterday.toISOString(),
        reviewCount: 5,
        masteryLevel: 90,
        notes: '',
      };
      const score = getUrgencyScore(greenTopic);
      expect(score).toBeLessThan(50);
    });
  });

  describe('isDueForReview', () => {
    it('should return true for never reviewed topics', () => {
      const topic: Topic = {
        id: '1',
        goalId: '1',
        name: 'Test',
        lastReviewed: null,
        reviewCount: 0,
        masteryLevel: 0,
        notes: '',
      };
      expect(isDueForReview(topic)).toBe(true);
    });
  });
});

