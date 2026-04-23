import { apiClient } from "../core/api-client.js";

export class CartService {
  async getCart() {
    return apiClient.request("/cart", { auth: true });
  }

  async addItem(productId, quantity) {
    return apiClient.request("/cart/items", {
      method: "POST",
      auth: true,
      body: { product_id: productId, quantity }
    });
  }

  async updateItem(productId, quantity) {
    return apiClient.request(`/cart/items/${productId}`, {
      method: "PUT",
      auth: true,
      body: { quantity }
    });
  }

  async removeItem(productId) {
    return apiClient.request(`/cart/items/${productId}`, {
      method: "DELETE",
      auth: true
    });
  }

  async clear() {
    return apiClient.request("/cart", {
      method: "DELETE",
      auth: true
    });
  }
}

export const cartService = new CartService();
