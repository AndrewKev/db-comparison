import { describe, expect, it } from "vitest";
import { validateIdentifier, validateSource } from "./validation";

describe("source form validation", () => {
  it("accepts separate Oracle schema and view identifiers", () => {
    expect(validateIdentifier("MY_SCHEMA", "Schema name")).toBeUndefined();
    expect(validateIdentifier("MY_VIEW", "View name")).toBeUndefined();
  });

  it("rejects SQL injection syntax", () => {
    expect(
      validateIdentifier("MY_VIEW; DROP TABLE USERS", "View name"),
    ).toBeTruthy();
  });

  it("requires connection, schema, and view", () => {
    const errors = validateSource({
      connectionString: "",
      schemaName: "",
      viewName: "",
    });
    expect(errors.connectionString).toBeTruthy();
    expect(errors.schemaName).toBeTruthy();
    expect(errors.viewName).toBeTruthy();
  });
});
