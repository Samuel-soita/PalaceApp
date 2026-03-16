import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 login requests per windowMs
    message: {
        error: 'Too many login attempts. Please try again after 60 seconds.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
