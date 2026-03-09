import { DateTime } from "luxon";
import { prisma } from "../../db/prisma.js";

type Slot = {
  start: string | null;
  end: string | null;
};

export async function getAvailableSlotsForService(params: {
  businessSlug: string;
  serviceId: string;
  from: string; // ISO date
  to: string; // ISO date
}): Promise<Slot[]> {
  const { businessSlug, serviceId, from, to } = params;

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
  });
  if (!business) {
    return [];
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, isActive: true },
  });
  if (!service) {
    return [];
  }

  const zone = business.timezone || "UTC";
  const fromDate = DateTime.fromISO(from, { zone }).startOf("day");
  const toDate = DateTime.fromISO(to, { zone }).endOf("day");

  const rules = await prisma.availabilityRule.findMany({
    where: {
      businessId: business.id,
      isActive: true,
      OR: [{ serviceId: null }, { serviceId }],
    },
  });

  if (!rules.length) {
    return [];
  }

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: business.id,
      serviceId,
      startDateTime: {
        gte: fromDate.toUTC().toJSDate(),
        lte: toDate.toUTC().toJSDate(),
      },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  const slots: Slot[] = [];

  let cursor = fromDate;
  while (cursor <= toDate) {
    const dayOfWeek = cursor.weekday % 7; // luxon: 1 = Monday ... 7 = Sunday
    const dayRules = rules.filter((r) => r.dayOfWeek === dayOfWeek);
    for (const rule of dayRules) {
      const [startHour, startMinute] = rule.startTime.split(":").map(Number);
      const [endHour, endMinute] = rule.endTime.split(":").map(Number);

      let slotStart = cursor.set({
        hour: startHour,
        minute: startMinute,
        second: 0,
        millisecond: 0,
      });
      const ruleEnd = cursor.set({
        hour: endHour,
        minute: endMinute,
        second: 0,
        millisecond: 0,
      });

      const slotDuration = service.durationMinutes;
      const buffer = rule.bufferMinutes;

      while (slotStart.plus({ minutes: slotDuration }) <= ruleEnd) {
        const slotEnd = slotStart.plus({ minutes: slotDuration });

        const overlapping = bookings.filter((b) => {
          const bStart = DateTime.fromJSDate(b.startDateTime);
          const bEnd = DateTime.fromJSDate(b.endDateTime);
          return (
            bStart < slotEnd.toUTC() &&
            bEnd > slotStart.toUTC() &&
            (b.status === "PENDING" || b.status === "CONFIRMED")
          );
        }).length;

        if (overlapping < rule.maxPerSlot) {
          slots.push({
            start: slotStart.toUTC().toISO(),
            end: slotEnd.toUTC().toISO(),
          });
        }

        slotStart = slotEnd.plus({ minutes: buffer });
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  return slots;
}

