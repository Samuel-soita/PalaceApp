import { describe, it, expect } from 'vitest';

describe('Sample Backend Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify basic math', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(10, 5)).toBe(15);
  });
});
