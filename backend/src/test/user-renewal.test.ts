import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEligibleForRenewal } from '../utils/user-utils.js';

describe('Membership Card Renewal Logic', () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('isEligibleForRenewal', () => {
        it('should return eligible: true if expiry is null', () => {
            const result = isEligibleForRenewal(null);
            expect(result.eligible).toBe(true);
            expect(result.daysRemaining).toBe(0);
        });

        it('should return eligible: false if expiry is more than 21 days away', () => {
            // Set current date to Jan 1st
            const now = new Date('2026-01-01T12:00:00Z');
            vi.setSystemTime(now);

            // Expiry is Feb 1st (31 days away)
            const expiry = new Date('2026-02-01T12:00:00Z');
            const result = isEligibleForRenewal(expiry);
            
            expect(result.eligible).toBe(false);
            expect(result.daysRemaining).toBe(31);
        });

        it('should return eligible: true if expiry is exactly 21 days away', () => {
             // Set current date to Jan 1st
             const now = new Date('2026-01-01T12:00:00Z');
             vi.setSystemTime(now);
 
             // Expiry is Jan 22nd (21 days away)
             const expiry = new Date('2026-01-22T12:00:00Z');
             const result = isEligibleForRenewal(expiry);
             
             expect(result.eligible).toBe(true);
             expect(result.daysRemaining).toBe(21);
        });

        it('should return eligible: true if expiry has passed (daysRemaining <= 0)', () => {
            // Set current date to Jan 10th
            const now = new Date('2026-01-10T12:00:00Z');
            vi.setSystemTime(now);

            // Expiry is Jan 1st (9 days ago)
            const expiry = new Date('2026-01-01T12:00:00Z');
            const result = isEligibleForRenewal(expiry);
            
            expect(result.eligible).toBe(true);
            expect(result.daysRemaining).toBe(-9);
       });
    });

});
