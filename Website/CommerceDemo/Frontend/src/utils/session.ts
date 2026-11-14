import type { Submission } from '../types/order';
const SUBMISSION_KEY = 'commerce-demo-public-submission-v1';
// This is an immutable request intent, never an anonymous identity/history token.
export function saveSubmission(submission: Submission | null): void {
  if (submission) sessionStorage.setItem(SUBMISSION_KEY, JSON.stringify(submission));
  else sessionStorage.removeItem(SUBMISSION_KEY);
}
export function readSubmission(): Submission | null {
  // This read also migrates storage: remove legacy identity/intent keys before parsing.
  // Cleanup stays outside the try below, preserving storage-access exception behavior.
  sessionStorage.removeItem('commerce-demo-session-v1');
  sessionStorage.removeItem('commerce-demo-submission-v1');
  try {
    const value = JSON.parse(sessionStorage.getItem(SUBMISSION_KEY) || 'null');
    if (value?.version === 'public-orders-v1' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.key) && typeof value.payload?.customer_email === 'string' && Array.isArray(value.payload.items) && typeof value.payload.simulate_failure === 'boolean' && value.payload.public_context?.contract === 'public-orders-v1' && /^\d{4}-\d{2}-\d{2}$/.test(value.payload.public_context.business_day) && Number.isFinite(Date.parse(value.payload.public_context.expires_at))) return value;
  } catch { /* Invalid local snapshots are discarded, never sent automatically. */ }
  // Invalid saved intent is discarded; a valid shape still needs public-day checks before send.
  sessionStorage.removeItem(SUBMISSION_KEY);
  return null;
}
