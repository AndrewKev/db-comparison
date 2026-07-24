import type {
  ApiErrorResponse,
  LoadViewScriptResponse,
  TestConnectionResponse,
} from "../models/oracle";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function post<TResponse>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("Backend cannot be reached. Verify that the API is running.");
  }

  const payload = (await response.json().catch(() => null)) as
    | TResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error("The backend returned an empty response.");
  }

  return payload as TResponse;
}

export const oracleClient = {
  testConnection(connectionString: string, signal?: AbortSignal) {
    return post<TestConnectionResponse>(
      "/api/oracle/test-connection",
      { connectionString },
      signal,
    );
  },

  loadViewScript(
    input: {
      connectionString: string;
      schemaName: string;
      viewName: string;
    },
    signal?: AbortSignal,
  ) {
    return post<LoadViewScriptResponse>("/api/oracle/load-view-script", input, signal);
  },
};
