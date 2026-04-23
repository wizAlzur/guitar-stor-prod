import { apiClient } from "../core/api-client.js";

export class ProductService {
  async list() {
    return apiClient.request("/products");
  }
}

export const productService = new ProductService();
