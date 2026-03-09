import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";
import availabilityRoutes from "./modules/availability/availability.routes.js";
import bookingRoutes from "./modules/bookings/bookings.routes.js";

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(availabilityRoutes);
app.use(bookingRoutes);

app.use(errorHandler);

export { app };

