import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: err.issues,
    });
  }

  if (typeof err === "object" && err && "code" in err) {
    const prismaError = err as { code?: string; message?: string };
    if (prismaError.code === "P2002") {
      return res.status(409).json({
        message: "Unique constraint violation",
      });
    }
  }

  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
}

