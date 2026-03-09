import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import {
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
} from "../../integrations/googleClient.js";
import { env } from "../../config/env.js";

const router = Router();

router.use(authMiddleware);

router.get("/integrations/google/calendar/connect", (req, res) => {
  const { businessId } = req.query;
  if (typeof businessId !== "string") {
    return res
      .status(400)
      .json({ message: "businessId query parameter is required" });
  }

  const url = getGoogleAuthUrl(businessId);
  return res.json({ url });
});

router.get("/integrations/google/calendar/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (typeof code !== "string") {
      return res.status(400).json({ message: "Missing code" });
    }

    const result = await handleGoogleOAuthCallback(
      typeof state === "string"
        ? { code, state }
        : { code },
    );

    const redirectUrl = `${env.APP_BASE_URL}/integrations/google/success?businessId=${encodeURIComponent(
      result.businessId,
    )}`;

    return res.redirect(302, redirectUrl);
  } catch (error) {
    return next(error);
  }
});

export default router;

