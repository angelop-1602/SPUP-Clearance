/**
 * Generates a unique document ID in the format: SPUP_Clearance_2025_XXXXXX
 * Where XXXXXX is a random 6-character alphanumeric string
 */
export function generateDocumentId(): string {
  const year = new Date().getFullYear();
  const randomId = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `SPUP_Clearance_${year}_${randomId}`;
}

/**
 * Validates if a document ID follows the correct format
 */
export function validateDocumentId(id: string): boolean {
  const pattern = /^SPUP_Clearance_\d{4}_[A-Z0-9]{6}$/;
  return pattern.test(id);
} 