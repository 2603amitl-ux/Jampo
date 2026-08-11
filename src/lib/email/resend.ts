import "server-only";
import { Resend } from "resend";

// Returns null when RESEND_API_KEY isn't configured yet, so callers can
// degrade gracefully (e.g. show "email not set up" instead of crashing)
// rather than requiring Resend to be wired up before the rest of the app
// works.
export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "ג'אמפו <onboarding@resend.dev>";
}
