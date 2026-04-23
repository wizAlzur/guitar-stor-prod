import { renderShell } from "../components/shell.js";
import { tokenStorage } from "./storage.js";

export class BasePage {
  constructor({ pageName, requireAuth = false }) {
    this.pageName = pageName;
    this.requireAuth = requireAuth;
  }

  mount() {
    renderShell({ currentPage: this.pageName });

    if (this.requireAuth && !tokenStorage.hasToken()) {
      const redirect = window.location.pathname.split("/").pop() || "catalog.html";
      const target = `./auth.html?redirect=${encodeURIComponent(redirect)}`;
      window.location.replace(target);
      return false;
    }

    return true;
  }

  setStatus(message) {
    const node = document.querySelector("[data-page-status]");
    if (node) {
      node.textContent = message;
    }
  }
}
