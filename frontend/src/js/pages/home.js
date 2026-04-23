import { BasePage } from "../core/base-page.js";
import { tokenStorage } from "../core/storage.js";

class HomePage extends BasePage {
  constructor() {
    super({ pageName: "home" });
    this.secondaryAction = null;
  }

  init() {
    if (!this.mount()) {
      return;
    }

    this.secondaryAction = document.querySelector("[data-home-secondary-action]");
    this.configureActions();

    if (tokenStorage.hasToken()) {
      this.setStatus("Пользователь авторизован. Можно открыть заказы или продолжить покупки в каталоге.");
      return;
    }

    this.setStatus("Главная страница показывает готовый сценарий курсового проекта и ведет к ключевым функциям магазина.");
  }

  configureActions() {
    if (!this.secondaryAction) {
      return;
    }

    if (tokenStorage.hasToken()) {
      this.secondaryAction.textContent = "Мои заказы";
      this.secondaryAction.href = "./orders.html";
      return;
    }

    this.secondaryAction.textContent = "Войти в аккаунт";
    this.secondaryAction.href = "./auth.html?redirect=index.html";
  }
}

new HomePage().init();
