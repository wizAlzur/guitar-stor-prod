import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const defaultBase = mode === "production" ? "./" : "/";

  return {
    base: env.VITE_SITE_BASE || defaultBase,
    server: {
      host: "0.0.0.0",
      port: 5173,
      open: "/catalog.html"
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "index.html"),
          catalog: resolve(import.meta.dirname, "catalog.html"),
          auth: resolve(import.meta.dirname, "auth.html"),
          cart: resolve(import.meta.dirname, "cart.html"),
          orders: resolve(import.meta.dirname, "orders.html"),
          paymentSuccess: resolve(import.meta.dirname, "payment-success.html"),
          paymentFail: resolve(import.meta.dirname, "payment-fail.html")
        }
      }
    }
  };
});
