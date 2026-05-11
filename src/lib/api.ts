import { buildApiUrl } from "@/lib/api-config";

type ErrorPayload = {
  detail?: unknown;
  message?: string;
};

type RequestHeaders = Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = { data: any };

class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseResponse(response: Response): Promise<ApiResponse> {
  const rawText = await response.text();
  let parsedBody: ErrorPayload | null = null;

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText) as ErrorPayload;
    } catch {
      parsedBody = { message: rawText };
    }
  }

  if (!response.ok) {
    const detail = parsedBody?.detail ?? parsedBody?.message ?? rawText;
    const message =
      typeof detail === "string" && detail.trim()
        ? detail
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, detail);
  }

  return { data: parsedBody };
}

function buildHeaders(headers: RequestHeaders, token: string | null, body?: unknown) {
  const finalHeaders: RequestHeaders = {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (!(body instanceof FormData) && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  return finalHeaders;
}

function buildBody(body: unknown) {
  if (body === undefined) {
    return undefined;
  }

  return body instanceof FormData ? body : JSON.stringify(body);
}

const api = {
  async get(url: string, headers: RequestHeaders = {}): Promise<ApiResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildApiUrl(url), {
      headers: buildHeaders(headers, token),
    });
    return parseResponse(response);
  },
  async post(url: string, body: unknown, headers: RequestHeaders = {}): Promise<ApiResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildApiUrl(url), {
      method: 'POST',
      headers: buildHeaders(headers, token, body),
      body: buildBody(body),
    });
    return parseResponse(response);
  },
  async put(url: string, body: unknown, headers: RequestHeaders = {}): Promise<ApiResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildApiUrl(url), {
      method: 'PUT',
      headers: buildHeaders(headers, token, body),
      body: buildBody(body),
    });
    return parseResponse(response);
  },
  async patch(url: string, body: unknown, headers: RequestHeaders = {}): Promise<ApiResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildApiUrl(url), {
      method: 'PATCH',
      headers: buildHeaders(headers, token, body),
      body: buildBody(body),
    });
    return parseResponse(response);
  },
  async delete(url: string, headers: RequestHeaders = {}): Promise<ApiResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildApiUrl(url), {
      method: 'DELETE',
      headers: buildHeaders(headers, token),
    });
    return parseResponse(response);
  },
};

export default api;
