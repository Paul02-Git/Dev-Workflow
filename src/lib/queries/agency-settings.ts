import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { agencySettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const SETTINGS_ROW_ID = "singleton";

/** One reusable, agency-wide "New Client Intake" link — not per-client, unlike handoff/portal tokens. */
export async function getIntakeToken(): Promise<string | null> {
  const [row] = await db.select({ intakeToken: agencySettings.intakeToken }).from(agencySettings).where(eq(agencySettings.id, SETTINGS_ROW_ID));
  return row?.intakeToken ?? null;
}

export async function generateIntakeToken(): Promise<string> {
  const existing = await getIntakeToken();
  if (existing) return existing;
  const token = randomBytes(24).toString("hex");
  await db.update(agencySettings).set({ intakeToken: token }).where(eq(agencySettings.id, SETTINGS_ROW_ID));
  return token;
}

export async function revokeIntakeToken(): Promise<void> {
  await db.update(agencySettings).set({ intakeToken: null }).where(eq(agencySettings.id, SETTINGS_ROW_ID));
}

export async function isValidIntakeToken(token: string): Promise<boolean> {
  const current = await getIntakeToken();
  return !!current && current === token;
}
