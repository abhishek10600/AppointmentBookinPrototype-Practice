import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import {
  availabilityRuleSchema,
  getAvailability,
  upsertAvailability,
} from "./availability.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/business/:businessId/availability", getAvailability);

router.post(
  "/business/:businessId/availability",
  validateBody(z.object({ rules: z.array(availabilityRuleSchema) })),
  upsertAvailability,
);

export default router;

