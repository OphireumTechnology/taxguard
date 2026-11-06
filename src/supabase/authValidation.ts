/** @license SPDX-License-Identifier: Apache-2.0 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmailFormat(email: string): { valid: boolean; message?: string } {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) {
    return { valid: false, message: 'Email address is required.' };
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }
  return { valid: true };
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  isValid: boolean;
  errors: string[];
  message?: string;
} {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password || '')) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password || '')) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password || '')) {
    errors.push('Password must contain at least one number.');
  }
  if (!/[^A-Za-z0-9]/.test(password || '')) {
    errors.push('Password must contain at least one special character.');
  }

  const valid = errors.length === 0;
  return {
    valid,
    isValid: valid,
    errors,
    message: errors[0]
  };
}
