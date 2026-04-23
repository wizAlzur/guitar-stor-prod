import { APP_ENV } from "./env.js";
import { tokenStorage } from "./storage.js";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const { method = "GET", body, headers = {}, auth = false } = options;
    const url = new URL(path, `${this.baseUrl}/`);
    const finalHeaders = new Headers({
      Accept: "application/json",
      ...headers
    });

    if (auth) {
      const token = tokenStorage.getToken();
      if (token) {
        finalHeaders.set("Authorization", `Bearer ${token}`);
      }
    }

    const config = { method, headers: finalHeaders };

    if (body !== undefined) {
      finalHeaders.set("Content-Type", "application/json");
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        (typeof payload === "object" && payload?.error) ||
        (typeof payload === "string" && payload) ||
        `HTTP ${response.status}`;

      throw new ApiError(message, response.status, payload);
    }

    return payload;
  }
}

export const apiClient = new ApiClient(APP_ENV.apiBaseUrl);
