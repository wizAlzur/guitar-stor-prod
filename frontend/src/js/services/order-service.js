import { apiClient } from "../core/api-client.js";

export class OrderService {
  async createOrder() {
    return apiClient.request("/orders", {
      method: "POST",
      auth: true
    });
  }

  async listOrders() {
    return apiClient.request("/orders", { auth: true });
  }

  async getOrder(id) {
    return apiClient.request(`/orders/${id}`, { auth: true });
  }
}

export const orderService = new OrderService();
