/**
 * Normalize axios/API rejections into a string message and optional details.
 * Backend uses { success, message, data }.
 */
export function getApiErrorMessage(err) {
  if (err == null) return 'Something went wrong. Please try again.';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  if (typeof err === 'object' && err.message) return String(err.message);
  return 'Something went wrong. Please try again.';
}
