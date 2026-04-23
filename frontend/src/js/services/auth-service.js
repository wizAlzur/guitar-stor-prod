import { apiClient } from "../core/api-client.js";
import { tokenStorage } from "../core/storage.js";

export class AuthService {
  async register(payload) {
    return apiClient.request("/register", {
      method: "POST",
      body: payload
    });
  }

  async login(payload) {
    const response = await apiClient.request("/login", {
      method: "POST",
      body: payload
    });

    if (response?.token) {
      tokenStorage.setToken(response.token);
    }

    return response;
  }

  logout() {
    tokenStorage.clear();
  }

  isAuthenticated() {
    return tokenStorage.hasToken();
  }
}

export const authService = new AuthService();
