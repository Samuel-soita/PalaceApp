import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Middleware to validate request data against a Zod schema.
 * Supports validating 'body', 'query', or 'params'.
 */
export const validate = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error: any) {
            if (error instanceof ZodError) {
                console.error(`\u001b[31m[VALIDATION ERROR in ${req.method} ${req.originalUrl}]\u001b[0m`, JSON.stringify({
                    reqBody: req.body,
                    errors: error.errors
                }, null, 2));
            }
            // Pass to global error handler which now handles ZodErrors
            next(error);
        }
    };
};
