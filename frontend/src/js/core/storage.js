const TOKEN_KEY = "guitar_store_token";

export class TokenStorage {
  getToken() {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  setToken(token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  hasToken() {
    return Boolean(this.getToken());
  }
}

export const tokenStorage = new TokenStorage();
