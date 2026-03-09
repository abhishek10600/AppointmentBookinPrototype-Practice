import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import {
  register,
  login,
  me,
  getGoogleLoginUrl,
  handleGoogleLoginCallback,
} from "./auth.controller.js";

const router = Router();

router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, me);

router.get("/auth/google/url", getGoogleLoginUrl);
router.get("/auth/google/callback", handleGoogleLoginCallback);

export default router;

