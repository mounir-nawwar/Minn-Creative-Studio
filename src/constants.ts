export const APP_BASE = '';
export const API_BASE = '/api';

export const RETENTION_DAYS = 30;

/**
 * Id of the shared hidden Playground sentinel project (see backend/services/database.ts).
 * Entering playground mode selects this project so canvas/chat/assets/cost paths
 * work unchanged without a real client project.
 */
export const PLAYGROUND_PROJECT_ID = 'playground';

export const AUTHORIZED_EMAILS = [
  "nawwarmounir@gmail.com",
  "rstadmori@gmail.com"
];

export const isAuthorized = (email: string | null | undefined) => {
  if (!email) return false;
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
};
