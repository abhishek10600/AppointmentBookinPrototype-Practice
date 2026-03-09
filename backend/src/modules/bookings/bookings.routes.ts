import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import {
  publicBookingSchema,
  listPublicServices,
  listPublicSlots,
  createPublicBooking,
  listBusinessBookings,
  updateBookingStatus,
} from "./bookings.controller.js";

const router = Router();

router.get("/public/:businessSlug/services", listPublicServices);

router.get(
  "/public/:businessSlug/services/:serviceId/slots",
  listPublicSlots,
);

router.post(
  "/public/:businessSlug/services/:serviceId/book",
  validateBody(publicBookingSchema),
  createPublicBooking,
);

router.use(authMiddleware);

router.get("/business/:businessId/bookings", listBusinessBookings);

router.patch(
  "/bookings/:id/status",
  validateBody(
    z.object({
      status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
    }),
  ),
  updateBookingStatus,
);

export default router;

