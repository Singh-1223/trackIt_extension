import { STORE_VALIDATION } from "../types/store";

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validates an incoming store payload against the required schema.
 * Checks for:
 * - Payload is a non-null object
 * - Payload size does not exceed 5MB
 * - All required fields are present
 * - All fields have the correct types (arrays or numbers)
 */
export function validateStore(payload: unknown): ValidationResult {
  const errors: string[] = [];

  // Check that payload is a non-null object
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Payload must be a non-null object"] };
  }

  // Check payload size (5MB limit)
  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > STORE_VALIDATION.maxPayloadSize) {
    errors.push(
      `Payload size exceeds maximum of ${STORE_VALIDATION.maxPayloadSize} bytes`
    );
  }

  const record = payload as Record<string, unknown>;

  // Check for missing required fields
  const missingFields: string[] = [];
  for (const field of STORE_VALIDATION.requiredFields) {
    if (!(field in record)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    errors.push(`Missing required fields: ${missingFields.join(", ")}`);
  }

  // Validate field types for present fields
  const wrongTypeFields: string[] = [];
  for (const [field, expectedType] of Object.entries(
    STORE_VALIDATION.fieldTypes
  )) {
    if (!(field in record)) {
      // Already reported as missing — skip type check
      continue;
    }

    const value = record[field];

    if (expectedType === "array") {
      if (!Array.isArray(value)) {
        wrongTypeFields.push(`${field} (expected array)`);
      }
    } else if (expectedType === "number") {
      if (typeof value !== "number") {
        wrongTypeFields.push(`${field} (expected number)`);
      }
    }
  }

  if (wrongTypeFields.length > 0) {
    errors.push(`Invalid field types: ${wrongTypeFields.join(", ")}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
