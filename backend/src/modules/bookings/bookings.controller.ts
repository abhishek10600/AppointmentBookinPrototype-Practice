import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { getAvailableSlotsForService } from "../availability/availability.service.js";

export const publicBookingSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  notes: z.string().max(1000).optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export async function listPublicServices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { businessSlug } = req.params as { businessSlug: string };
    const business = await prisma.business.findUnique({
      where: { slug: businessSlug },
    });
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const services = await prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
    });

    return res.json({ business, services });
  } catch (error) {
    return next(error);
  }
}

export async function listPublicSlots(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { businessSlug, serviceId } = req.params as {
      businessSlug: string;
      serviceId: string;
    };
    const { from, to } = req.query as { from?: string; to?: string };

    if (typeof from !== "string" || typeof to !== "string") {
      return res
        .status(400)
        .json({ message: "`from` and `to` query params are required" });
    }

    const slots = await getAvailableSlotsForService({
      businessSlug,
      serviceId,
      from,
      to,
    });

    return res.json({ slots });
  } catch (error) {
    return next(error);
  }
}

export async function createPublicBooking(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { businessSlug, serviceId } = req.params as {
      businessSlug: string;
      serviceId: string;
    };
    const body = req.body as z.infer<typeof publicBookingSchema>;

    const business = await prisma.business.findUnique({
      where: { slug: String(businessSlug) },
    });
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: String(serviceId),
        businessId: business.id,
        isActive: true,
      },
    });
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const requestedStart = new Date(body.start);
    const requestedEnd = new Date(body.end);

    const overlapping = await prisma.booking.count({
      where: {
        businessId: business.id,
        serviceId: service.id,
        startDateTime: { lt: requestedEnd },
        endDateTime: { gt: requestedStart },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    if (overlapping > 0) {
      return res
        .status(409)
        .json({ message: "Selected time slot is no longer available" });
    }

    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: body.customerName,
        email: body.customerEmail,
        phone: body.customerPhone ?? null,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        businessId: business.id,
        serviceId: service.id,
        customerId: customer.id,
        startDateTime: requestedStart,
        endDateTime: requestedEnd,
        status: "CONFIRMED",
        locationType: service.isOnline ? "ONLINE" : "OFFLINE",
        notes: body.notes ?? null,
      },
      include: {
        customer: true,
        service: true,
      },
    });

    return res.status(201).json(booking);
  } catch (error) {
    return next(error);
  }
}

export async function listBusinessBookings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { businessId } = req.params;
    const { status, from, to } = req.query;

    const where: any = { businessId };
    if (typeof status === "string") {
      where.status = status;
    }
    if (typeof from === "string" || typeof to === "string") {
      where.startDateTime = {};
      if (typeof from === "string") {
        where.startDateTime.gte = new Date(from);
      }
      if (typeof to === "string") {
        where.startDateTime.lte = new Date(to);
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: true,
        service: true,
      },
      orderBy: { startDateTime: "asc" },
    });

    res.json(bookings);
  } catch (error) {
    next(error);
  }
}

export async function updateBookingStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { status } = req.body as {
      status: "PENDING" | "CONFIRMED" | "CANCELLED";
    };

    const booking = await prisma.booking.update({
      where: { id: String(id) },
      data: { status },
    });

    res.json(booking);
  } catch (error) {
    next(error);
  }
}

