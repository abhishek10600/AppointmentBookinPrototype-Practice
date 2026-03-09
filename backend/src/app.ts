import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";
import availabilityRoutes from "./modules/availability/availability.routes.js";
import bookingRoutes from "./modules/bookings/bookings.routes.js";
import googleIntegrationRoutes from "./modules/integrations/google.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";

const app = express();

app.use(
  cors({
    origin: env.APP_BASE_URL,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ status: "ok and good and fine" });
});

app.use(authRoutes);
app.use(availabilityRoutes);
app.use(bookingRoutes);
app.use(googleIntegrationRoutes);

app.use(errorHandler);

export { app };

