const identifier = /^[A-Za-z][A-Za-z0-9_$#]*$/;

export interface SourceValidationErrors {
  connectionString?: string;
  schemaName?: string;
  viewName?: string;
}

export function validateIdentifier(
  value: string,
  label: "Schema name" | "View name",
): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  if (value.trim().length > 30 || !identifier.test(value.trim())) {
    return `${label} must be one safe, unquoted Oracle identifier.`;
  }
  return undefined;
}

export function validateSource(input: {
  connectionString: string;
  schemaName: string;
  viewName: string;
}): SourceValidationErrors {
  return {
    connectionString: input.connectionString.trim()
      ? undefined
      : "Connection string is required.",
    schemaName: validateIdentifier(input.schemaName, "Schema name"),
    viewName: validateIdentifier(input.viewName, "View name"),
  };
}

export function hasValidationErrors(errors: SourceValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}
