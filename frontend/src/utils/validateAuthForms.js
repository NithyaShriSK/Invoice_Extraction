const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Matches backend Joi: alphanum, 3–30 */
const USERNAME_RE = /^[a-zA-Z0-9]{3,30}$/;

export function validateLoginFields({ email, password }) {
  const errors = {};
  const e = (email || '').trim();
  const p = password || '';

  if (!e) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(e)) errors.email = 'Enter a valid email address';

  if (!p) errors.password = 'Password is required';

  return errors;
}

export function validateSignupFields(formData) {
  const errors = {};
  const username = (formData.username || '').trim();
  const email = (formData.email || '').trim();
  const password = formData.password || '';
  const confirmPassword = formData.confirmPassword || '';

  if (!username) errors.username = 'Username is required';
  else if (!USERNAME_RE.test(username)) {
    errors.username = 'Username must be 3–30 letters or numbers only';
  }

  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';

  if (!password) errors.password = 'Password is required';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters';

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  return errors;
}
