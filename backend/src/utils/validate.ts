import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        issues: result.error.issues,
      });
    }
    // eslint-disable-next-line no-param-reassign
    req.body = result.data as unknown as typeof req.body;
    return next();
  };
}

