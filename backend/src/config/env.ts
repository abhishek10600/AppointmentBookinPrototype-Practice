import dotenv from "dotenv";

dotenv.config();

type Env = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  APP_BASE_URL: string;
};

function getEnv(): Env {
  const {
    NODE_ENV = "development",
    PORT = "4000",
    DATABASE_URL,
    JWT_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    APP_BASE_URL,
  } = process.env;

  function requireEnv(value: string | undefined, key: string): string {
    if (!value) {
      throw new Error(`Missing required environment variable ${key}`);
    }
    return value;
  }

  return {
    NODE_ENV: NODE_ENV as Env["NODE_ENV"],
    PORT: Number(PORT),
    DATABASE_URL: requireEnv(DATABASE_URL, "DATABASE_URL"),
    JWT_SECRET: requireEnv(JWT_SECRET, "JWT_SECRET"),
    GOOGLE_CLIENT_ID: requireEnv(GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: requireEnv(
      GOOGLE_CLIENT_SECRET,
      "GOOGLE_CLIENT_SECRET",
    ),
    GOOGLE_REDIRECT_URI: requireEnv(
      GOOGLE_REDIRECT_URI,
      "GOOGLE_REDIRECT_URI",
    ),
    CLOUDINARY_CLOUD_NAME: requireEnv(
      CLOUDINARY_CLOUD_NAME,
      "CLOUDINARY_CLOUD_NAME",
    ),
    CLOUDINARY_API_KEY: requireEnv(
      CLOUDINARY_API_KEY,
      "CLOUDINARY_API_KEY",
    ),
    CLOUDINARY_API_SECRET: requireEnv(
      CLOUDINARY_API_SECRET,
      "CLOUDINARY_API_SECRET",
    ),
    SMTP_HOST: requireEnv(SMTP_HOST, "SMTP_HOST"),
    SMTP_PORT: Number(requireEnv(SMTP_PORT, "SMTP_PORT")),
    SMTP_USER: requireEnv(SMTP_USER, "SMTP_USER"),
    SMTP_PASS: requireEnv(SMTP_PASS, "SMTP_PASS"),
    APP_BASE_URL: requireEnv(APP_BASE_URL, "APP_BASE_URL"),
  };
}

export const env = getEnv();

