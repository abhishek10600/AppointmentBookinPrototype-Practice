import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";

export const availabilityRuleSchema = z.object({
  serviceId: z.string().cuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  bufferMinutes: z.number().int().min(0).default(0),
  maxPerSlot: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;

export async function getAvailability(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const businessId = req.params.businessId as string;
    const rules = await prisma.availabilityRule.findMany({
      where: { businessId },
    });
    res.json(rules);
  } catch (error) {
    next(error);
  }
}

export async function upsertAvailability(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { businessId } = req.params;
    const { rules } = req.body as { rules: AvailabilityRuleInput[] };

    const businessIdStr = String(businessId);

    await prisma.$transaction([
      prisma.availabilityRule.deleteMany({ where: { businessId: businessIdStr } }),
      prisma.availabilityRule.createMany({
        data: rules.map((r) => ({
          businessId: businessIdStr,
          serviceId: r.serviceId ?? null,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          bufferMinutes: r.bufferMinutes,
          maxPerSlot: r.maxPerSlot,
          isActive: r.isActive,
        })),
      }),
    ]);

    const updated = await prisma.availabilityRule.findMany({
      where: { businessId: businessIdStr },
    });

    res.status(201).json(updated);
  } catch (error) {
    next(error);
  }
}

