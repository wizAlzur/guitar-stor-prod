import { createProductCard, createProductCardSkeleton } from "../components/product-card.js";
import { showToast } from "../components/toast.js";
import { BasePage } from "../core/base-page.js";
import { authService } from "../services/auth-service.js";
import { cartService } from "../services/cart-service.js";
import { productService } from "../services/product-service.js";

class CatalogPage extends BasePage {
  constructor() {
    super({ pageName: "catalog" });
    this.products = [];
    this.grid = null;
    this.searchInput = null;
    this.clearButton = null;
    this.summaryNode = null;
    this.authHintNode = null;
  }

  async init() {
    if (!this.mount()) {
      return;
    }

    this.cacheElements();
    if (!this.grid) {
      return;
    }

    this.renderAuthHint();
    this.bindSearch();
    this.bindGridActions();
    this.renderLoading();
    await this.loadProducts();
  }

  cacheElements() {
    this.grid = document.querySelector("[data-catalog-grid]");
    this.toolbar = document.querySelector("[data-catalog-toolbar]");
    this.searchInput = document.querySelector("[data-catalog-search]");
    this.clearButton = document.querySelector("[data-catalog-clear]");
    this.summaryNode = document.querySelector("[data-catalog-summary]");
    this.authHintNode = document.querySelector("[data-catalog-auth-hint]");
  }

  bindSearch() {
    this.toolbar?.addEventListener("submit", (event) => {
      event.preventDefault();
    });

    if (!this.searchInput) {
      return;
    }

    this.searchInput.addEventListener("input", () => {
      this.applySearch(this.searchInput.value);
    });

    this.clearButton?.addEventListener("click", () => {
      this.searchInput.value = "";
      this.applySearch("");
      this.searchInput.focus();
    });
  }

  bindGridActions() {
    this.grid.addEventListener("click", async (event) => {
      const productButton = event.target.closest('[data-product-action="add-to-cart"]');
      if (productButton) {
        const productId = Number(productButton.dataset.productId);
        if (productId) {
          await this.handleAddToCart(productButton, productId);
        }
        return;
      }

      const actionButton = event.target.closest("[data-catalog-action]");
      if (!actionButton) {
        return;
      }

      switch (actionButton.dataset.catalogAction) {
        case "retry":
          this.renderLoading();
          await this.loadProducts();
          break;
        case "clear-search":
          if (this.searchInput) {
            this.searchInput.value = "";
          }
          this.applySearch("");
          break;
        default:
          break;
      }
    });
  }

  renderAuthHint() {
    if (!this.authHintNode) {
      return;
    }

    this.authHintNode.textContent = authService.isAuthenticated()
      ? "Вы авторизованы: товары можно сразу добавлять в корзину."
      : "Для добавления товара в корзину потребуется вход. После авторизации вернем вас обратно в каталог.";
  }

  async handleAddToCart(button, productId) {
    if (!authService.isAuthenticated()) {
      showToast("Для добавления товара сначала войдите в аккаунт");
      this.setStatus("Для покупки нужен вход в аккаунт. Перенаправляем на авторизацию...");
      window.setTimeout(() => {
        window.location.href = "./auth.html?redirect=catalog.html";
      }, 350);
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Добавляем...";

    try {
      await cartService.addItem(productId, 1);
      button.textContent = "Добавлено";
      this.setStatus("Товар добавлен в корзину. Можно продолжить покупки или перейти к оформлению.");
      this.updateSummaryText("Товар добавлен в корзину. При необходимости откройте корзину из панели действий.");
      showToast("Товар добавлен в корзину");
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=catalog.html";
        return;
      }

      showToast(error?.message || "Не удалось добавить товар в корзину");
      this.setStatus("Ошибка при добавлении товара в корзину.");
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
      }, 450);
    }
  }

  async loadProducts() {
    try {
      const products = await productService.list();
      this.products = Array.isArray(products) ? products : [];
      this.applySearch(this.searchInput?.value || "");
    } catch (error) {
      console.error(error);
      this.renderError();
    }
  }

  applySearch(rawQuery) {
    const query = this.normalizeQuery(rawQuery);
    const filteredProducts = this.products.filter((product) => {
      const haystack = `${product.name || ""} ${product.description || ""}`.toLowerCase();
      return haystack.includes(query);
    });

    this.updateSearchControls(rawQuery);

    if (!this.products.length) {
      this.renderState({
        title: "Каталог пока пуст",
        text: "В backend еще нет товаров. Как только они появятся в API, витрина автоматически покажет их здесь.",
        status: "Список товаров пуст.",
        summary: "Пока нет ни одного товара для показа.",
        actions: [{ type: "button", action: "retry", label: "Повторить загрузку" }]
      });
      return;
    }

    if (!filteredProducts.length) {
      this.renderState({
        title: "По запросу ничего не найдено",
        text: "Попробуйте сократить запрос или очистить строку поиска, чтобы снова увидеть весь каталог.",
        status: `По запросу "${rawQuery.trim()}" товары не найдены.`,
        summary: "По текущему запросу совпадений нет.",
        actions: [
          { type: "button", action: "clear-search", label: "Сбросить поиск" },
          { type: "link", href: "./cart.html", label: "Открыть корзину" }
        ]
      });
      return;
    }

    this.renderProducts(filteredProducts, query);
  }

  normalizeQuery(value) {
    return String(value || "").trim().toLowerCase();
  }

  updateSearchControls(rawQuery = "") {
    if (this.clearButton) {
      this.clearButton.disabled = !String(rawQuery || "").trim();
    }
  }

  updateSummaryText(message) {
    if (this.summaryNode) {
      this.summaryNode.textContent = message;
    }
  }

  renderLoading() {
    this.grid.innerHTML = "";

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 6; index += 1) {
      fragment.append(createProductCardSkeleton());
    }

    this.grid.append(fragment);
    this.updateSearchControls(this.searchInput?.value || "");
    this.updateSummaryText("Загружаем каталог и готовим карточки товаров...");
    this.setStatus("Загружаем товары из API...");
  }

  renderProducts(products, query = "") {
    this.grid.innerHTML = "";

    const fragment = document.createDocumentFragment();
    products.forEach((product) => {
      fragment.append(
        createProductCard(product, {
          actionName: "add-to-cart"
        })
      );
    });

    this.grid.append(fragment);
    this.updateSummaryText(
      query
        ? `Найдено ${products.length} товар(ов) по запросу "${this.searchInput?.value.trim()}".`
        : `В каталоге доступно ${products.length} товар(ов).`
    );
    this.setStatus(
      query
        ? `Найдено ${products.length} товар(ов) по запросу "${this.searchInput?.value.trim()}".`
        : `Каталог загружен: ${products.length} товар(ов).`
    );
  }

  renderState({ title, text, status, summary, actions = [], tone = "" }) {
    const actionsMarkup = actions.length
      ? `
        <div class="empty-state__actions">
          ${actions
            .map((action) => {
              if (action.type === "link") {
                return `<a class="button button--ghost" href="${action.href}">${action.label}</a>`;
              }

              return `<button class="button button--ghost" type="button" data-catalog-action="${action.action}">${action.label}</button>`;
            })
            .join("")}
        </div>
      `
      : "";

    this.grid.innerHTML = `
      <article class="empty-state${tone ? ` ${tone}` : ""}">
        <h2 class="empty-state__title">${title}</h2>
        <p class="empty-state__text">${text}</p>
        ${actionsMarkup}
      </article>
    `;

    this.updateSummaryText(summary);
    this.setStatus(status);
  }

  renderError() {
    this.renderState({
      title: "Не удалось загрузить каталог",
      text: "Проверьте, что backend доступен, и попробуйте выполнить загрузку еще раз.",
      status: "Ошибка загрузки каталога.",
      summary: "Каталог сейчас недоступен.",
      tone: "empty-state--error",
      actions: [
        { type: "button", action: "retry", label: "Повторить загрузку" },
        { type: "link", href: "./index.html", label: "На главную" }
      ]
    });
  }
}

new CatalogPage().init();
