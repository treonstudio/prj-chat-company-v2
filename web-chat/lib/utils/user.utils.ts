const EMAIL_DOMAIN = '@chatapp.com';

/**
 * Extracts the username (part before @) from an email address
 * Specifically designed for @chatapp.com domain
 * @param email - The email address to extract username from
 * @returns The username portion of the email
 * @example
 * getUsernameFromEmail("kiki@chatapp.com") // returns "kiki"
 */
export function getUsernameFromEmail(email: string): string {
  if (!email) return '';

  // Remove the domain suffix if it exists
  if (email.endsWith(EMAIL_DOMAIN)) {
    return email.replace(EMAIL_DOMAIN, '');
  }

  // Fallback: just get the part before @
  const parts = email.split('@');
  return parts[0] || email;
}

/**
 * Converts username to email by appending @chatapp.com
 * @param username - The username to convert
 * @returns The full email address
 * @example
 * usernameToEmail("kiki") // returns "kiki@chatapp.com"
 */
export function usernameToEmail(username: string): string {
  if (!username) return '';
  return username + EMAIL_DOMAIN;
}
