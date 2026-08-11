// Employees log in with a username. Supabase Auth requires an email, so we
// map every username to a synthetic address on a fixed internal domain.
// This is an implementation detail — it must never be shown to users.
const USERNAME_DOMAIN = "jampo.internal";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}
