import { describe, it, expect } from 'vitest';
import { approvalQuorumMet, resolveApprover } from '../utils/approval-chain.js';

const assigned = [
    { userId: 'pA', role: 'PASTOR', approved: false },
    { userId: 'pB', role: 'PASTOR', approved: false },
    { userId: 'bishop', role: 'BISHOP', approved: false },
];

describe('Leadership approval chain', () => {
    it('assigned approvers sign their own row', () => {
        expect(resolveApprover(assigned, { id: 'pA', role: 'PASTOR' })).toEqual({ kind: 'update' });
        expect(resolveApprover(assigned, { id: 'bishop', role: 'SUPER_ADMIN' })).toEqual({ kind: 'update' });
    });

    it('rejects unassigned pastors and double signing', () => {
        expect(() => resolveApprover(assigned, { id: 'pC', role: 'PASTOR' })).toThrow(/assigned/);
        const signed = assigned.map((a) => (a.userId === 'pA' ? { ...a, approved: true } : a));
        expect(() => resolveApprover(signed, { id: 'pA', role: 'PASTOR' })).toThrow(/already/);
    });

    it('lets legacy items without assignments collect the missing signatures', () => {
        expect(resolveApprover([], { id: 'pC', role: 'ASSOCIATE_PASTOR' })).toEqual({ kind: 'create', role: 'PASTOR' });
        expect(resolveApprover([], { id: 'b', role: 'SUPER_ADMIN' })).toEqual({ kind: 'create', role: 'BISHOP' });
        const twoSigned = [
            { userId: 'p1', role: 'PASTOR', approved: true },
            { userId: 'p2', role: 'PASTOR', approved: true },
        ];
        expect(() => resolveApprover(twoSigned, { id: 'p3', role: 'PASTOR' })).toThrow();
    });

    it('requires the Bishop and 2 pastors to have actually signed', () => {
        expect(approvalQuorumMet(assigned)).toBe(false);
        const pastorsOnly = assigned.map((a) => (a.role === 'PASTOR' ? { ...a, approved: true } : a));
        expect(approvalQuorumMet(pastorsOnly)).toBe(false);
        expect(approvalQuorumMet(assigned.map((a) => ({ ...a, approved: true })))).toBe(true);
    });
});
