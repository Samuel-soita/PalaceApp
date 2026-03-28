import rateLimit from 'express-rate-limit';

// Scaling for high-concurrency: 500 attempts per 15 minutes.
// This supports the 400+ concurrent user requirement for MISSION-CRITICAL peaks.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Safety lock engaged for 15 minutes.' }
});

// Strict limiter for critical mutations (e.g. Purge, Role Promotions)
// 10 attempts per hour.
export const mutationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Mutation rate limit exceeded. You have triggered internal security locks.' }
});

// Standard limiter for general creation tasks (Baptism requests, messages)
// 30 per minute
export const standardMutationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'You are submitting requests too quickly. Please cool down.' }
});
