/**
 * Sanitize text by removing problematic Unicode characters
 * that can break layout or render incorrectly
 */
export function sanitizeText(text: string): string {
  if (!text) return text;

  return text
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove zero-width joiner and non-joiner
    .replace(/[\u200C\u200D]/g, '')
    // Remove bidirectional control characters (RTL/LTR marks)
    .replace(/[\u202A-\u202E]/g, '')
    // Remove variation selectors
    .replace(/[\uFE00-\uFE0F]/g, '')
    // Remove combining diacritical marks that appear standalone
    .replace(/^[\u0300-\u036F]+/g, '')
    // Remove directional formatting characters
    .replace(/[\u2066-\u2069]/g, '')
    // Remove other format characters
    .replace(/[\u2028-\u2029]/g, '')
    // Normalize Unicode to NFC form
    .normalize('NFC');
}

/**
 * Sanitize text for display in chat messages
 * More aggressive cleaning for user-generated content
 */
export function sanitizeMessageText(text: string): string {
  if (!text) return text;

  let sanitized = sanitizeText(text);

  // Remove excessive repeating invisible characters
  sanitized = sanitized.replace(/(\s)\1{10,}/g, '$1');

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  return sanitized;
}

/**
 * Check if text contains suspicious Unicode patterns
 * that might be used for spoofing or layout breaking
 */
export function containsSuspiciousCharacters(text: string): boolean {
  if (!text) return false;

  // Check for excessive zero-width characters
  const zeroWidthCount = (text.match(/[\u200B-\u200D\uFEFF]/g) || []).length;
  if (zeroWidthCount > 5) return true;

  // Check for excessive combining marks
  const combiningCount = (text.match(/[\u0300-\u036F]/g) || []).length;
  if (combiningCount > text.length * 0.3) return true;

  // Check for bidirectional override abuse
  const bidiCount = (text.match(/[\u202A-\u202E]/g) || []).length;
  if (bidiCount > 2) return true;

  return false;
}
