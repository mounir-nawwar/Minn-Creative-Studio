export const APP_BASE = '';
export const API_BASE = '/api';

export const RETENTION_DAYS = 30;

export const AUTHORIZED_EMAILS = [
  "nawwarmounir@gmail.com",
  "rstadmori@gmail.com"
];

export const isAuthorized = (email: string | null | undefined) => {
  if (!email) return false;
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
};
