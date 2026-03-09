import { google } from "googleapis";
import { DateTime } from "luxon";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI,
);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function getGoogleAuthUrl(businessId: string): string {
  const state = Buffer.from(JSON.stringify({ businessId })).toString("base64url");

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });

  return url;
}

export async function handleGoogleOAuthCallback(params: {
  code: string;
  state?: string;
}) {
  const { code, state } = params;
  if (!state) {
    throw new Error("Missing state");
  }

  let businessId: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as { businessId: string };
    businessId = decoded.businessId;
  } catch {
    throw new Error("Invalid state");
  }

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens from Google");
  }

  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const me = await oauth2.userinfo.get();
  const googleUserId = me.data.id ?? "";

  const expiryDate = tokens.expiry_date
    ? DateTime.fromMillis(tokens.expiry_date).toJSDate()
    : DateTime.utc().plus({ hours: 1 }).toJSDate();

  await prisma.googleIntegration.upsert({
    where: { businessId },
    create: {
      businessId,
      googleUserId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate,
      calendarId: "primary",
    },
    update: {
      googleUserId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate,
    },
  });

  return { businessId };
}

async function getAuthorizedCalendarClient(businessId: string) {
  const integration = await prisma.googleIntegration.findUnique({
    where: { businessId },
  });
  if (!integration) {
    return null;
  }

  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
  });

  // Refresh if needed
  const tokenInfo = await oauth2Client.getAccessToken();
  if (tokenInfo.res?.data?.access_token) {
    const newAccessToken = tokenInfo.res.data.access_token;
    if (newAccessToken !== integration.accessToken) {
      await prisma.googleIntegration.update({
        where: { businessId },
        data: {
          accessToken: newAccessToken,
          expiryDate: DateTime.utc().plus({ hours: 1 }).toJSDate(),
        },
      });
    }
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  return { calendar, integration };
}

export async function createGoogleCalendarEventForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      business: true,
      service: true,
      customer: true,
    },
  });

  if (!booking) return;
  if (booking.locationType !== "ONLINE") return;

  const { calendar, integration } = (await getAuthorizedCalendarClient(
    booking.businessId,
  )) ?? { calendar: null, integration: null };

  if (!calendar || !integration) {
    // No calendar connected for this business; skip silently
    return;
  }

  const timeZone = booking.business.timezone || "UTC";

  const event = {
    summary: booking.service.name,
    description: booking.notes ?? null,
    start: {
      dateTime: booking.startDateTime.toISOString(),
      timeZone,
    },
    end: {
      dateTime: booking.endDateTime.toISOString(),
      timeZone,
    },
    attendees: [
      { email: booking.customer.email, displayName: booking.customer.name },
    ],
    conferenceData: {
      createRequest: {
        requestId: `booking-${booking.id}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId: integration.calendarId ?? "primary",
    requestBody: event,
    conferenceDataVersion: 1,
  });

  const responseData = (await response).data;

  const meetingLink =
    responseData.hangoutLink ??
    responseData.conferenceData?.entryPoints?.[0]?.uri ??
    null;

  if (meetingLink) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { meetingLink },
    });
  }
}

