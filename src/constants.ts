export const APP_BASE = '/studio';
export const API_BASE = `${APP_BASE}/api`;

export const AUTHORIZED_EMAILS = [
  "nawwarmounir@gmail.com",
  "rstadmori@gmail.com"
];

export const isAuthorized = (email: string | null | undefined) => {
  if (!email) return false;
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
};
