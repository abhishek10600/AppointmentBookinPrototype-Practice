import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { google } from "googleapis";
import { prisma } from "../../db/prisma.js";
import { signJwt } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid payload",
        issues: parsed.error.issues,
      });
    }
    const { email, password, name } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name ?? null,
      },
    });

    const token = signJwt({ id: user.id, email: user.email });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid payload",
        issues: parsed.error.issues,
      });
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signJwt({ id: user.id, email: user.email });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    return next(error);
  }
}

// Google login

const googleLoginClient = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI,
);

const GOOGLE_LOGIN_SCOPES = [
  "openid",
  "email",
  "profile",
];

export function getGoogleLoginUrl(req: Request, res: Response) {
  const redirect =
    typeof req.query.redirect === "string"
      ? req.query.redirect
      : env.APP_BASE_URL;

  const state = Buffer.from(
    JSON.stringify({ redirect }),
  ).toString("base64url");

  const url = googleLoginClient.generateAuthUrl({
    access_type: "online",
    scope: GOOGLE_LOGIN_SCOPES,
    state,
  });

  return res.json({ url });
}

export async function handleGoogleLoginCallback(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { code, state } = req.query;
    if (typeof code !== "string") {
      return res.status(400).json({ message: "Missing code" });
    }

    let redirect = env.APP_BASE_URL;
    if (typeof state === "string") {
      try {
        const decoded = JSON.parse(
          Buffer.from(state, "base64url").toString("utf8"),
        ) as { redirect?: string };
        if (decoded.redirect) {
          redirect = decoded.redirect;
        }
      } catch {
        // ignore bad state; fallback to default redirect
      }
    }

    const { tokens } = await googleLoginClient.getToken(code);
    googleLoginClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: googleLoginClient });
    const me = await oauth2.userinfo.get();

    const email = (me.data.email ?? "").toLowerCase();
    if (!email) {
      return res
        .status(400)
        .json({ message: "Google account does not have an email" });
    }

    const name = me.data.name ?? undefined;
    const avatarUrl = me.data.picture ?? undefined;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name ?? null,
        avatarUrl: avatarUrl ?? null,
      },
      create: {
        email,
        name: name ?? null,
        avatarUrl: avatarUrl ?? null,
      },
    });

    const token = signJwt({ id: user.id, email: user.email });

    const url = new URL(redirect);
    url.searchParams.set("token", token);

    return res.redirect(url.toString());
  } catch (error) {
    return next(error);
  }
}

