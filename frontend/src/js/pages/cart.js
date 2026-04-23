import { createCartItem, createCartItemSkeleton } from "../components/cart-item.js";
import { showToast } from "../components/toast.js";
import { BasePage } from "../core/base-page.js";
import { cartService } from "../services/cart-service.js";
import { orderService } from "../services/order-service.js";
import { formatCurrency } from "../shared/format.js";

class CartPage extends BasePage {
  constructor() {
    super({ pageName: "cart", requireAuth: true });
    this.list = null;
    this.countNode = null;
    this.totalNode = null;
    this.clearButton = null;
    this.checkoutButton = null;
    this.summaryStatusNode = null;
    this.summaryHintNode = null;
  }

  async init() {
    if (!this.mount()) {
      return;
    }

    this.cacheElements();
    this.bindActions();
    this.renderLoading();
    await this.loadCart();
  }

  cacheElements() {
    this.list = document.querySelector("[data-cart-list]");
    this.countNode = document.querySelector("[data-cart-count]");
    this.totalNode = document.querySelector("[data-cart-total]");
    this.clearButton = document.querySelector("[data-cart-clear]");
    this.checkoutButton = document.querySelector("[data-cart-checkout]");
    this.summaryStatusNode = document.querySelector("[data-cart-summary-status]");
    this.summaryHintNode = document.querySelector("[data-cart-summary-hint]");
  }

  bindActions() {
    if (!this.list) {
      return;
    }

    this.list.addEventListener("click", async (event) => {
      const control = event.target.closest("[data-cart-action]");
      if (control) {
        const productId = Number(control.dataset.productId);
        if (!productId) {
          return;
        }

        const itemNode = control.closest("[data-product-id]");
        const quantityInput = itemNode?.querySelector("[data-cart-quantity]");
        const currentQuantity = Number(quantityInput?.value || 0);

        switch (control.dataset.cartAction) {
          case "increase":
            await this.updateQuantity(itemNode, productId, currentQuantity + 1);
            return;
          case "decrease":
            await this.updateQuantity(itemNode, productId, Math.max(0, currentQuantity - 1));
            return;
          case "remove":
            await this.removeItem(itemNode, productId);
            return;
          default:
            return;
        }
      }

      const action = event.target.closest("[data-cart-view-action]");
      if (!action) {
        return;
      }

      if (action.dataset.cartViewAction === "retry") {
        this.renderLoading();
        await this.loadCart();
      }
    });

    this.list.addEventListener("change", async (event) => {
      const input = event.target.closest("[data-cart-quantity]");
      if (!input) {
        return;
      }

      const productId = Number(input.dataset.productId);
      const itemNode = input.closest("[data-product-id]");
      const nextQuantity = Math.max(0, Number(input.value || 0));
      await this.updateQuantity(itemNode, productId, nextQuantity);
    });

    this.clearButton?.addEventListener("click", async () => {
      await this.clearCart();
    });

    this.checkoutButton?.addEventListener("click", () => {
      void this.checkout();
    });
  }

  async loadCart() {
    try {
      const cart = await cartService.getCart();
      this.renderCart(cart);
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=cart.html";
        return;
      }

      this.renderError();
    }
  }

  renderLoading() {
    if (!this.list) {
      return;
    }

    this.list.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 3; index += 1) {
      fragment.append(createCartItemSkeleton());
    }

    this.list.append(fragment);
    this.updateSummary(0, 0, false);
    this.setSummaryState("Загружаем состав корзины и пересчитываем итог.");
    this.setSummaryHint("Как только данные придут из API, здесь появятся итоговая сумма и доступные действия.");
    this.setStatus("Загружаем содержимое корзины...");
  }

  renderCart(cart) {
    if (!this.list) {
      return;
    }

    const items = Array.isArray(cart?.items) ? cart.items : [];
    if (!items.length) {
      this.list.innerHTML = `
        <article class="empty-state">
          <h2 class="empty-state__title">Корзина пока пуста</h2>
          <p class="empty-state__text">Добавьте товары из каталога, и они сразу появятся здесь.</p>
          <div class="empty-state__actions">
            <a class="button button--primary" href="./catalog.html">Перейти в каталог</a>
            <a class="button button--ghost" href="./orders.html">История заказов</a>
          </div>
        </article>
      `;

      this.updateSummary(0, 0, false);
      this.setSummaryState("Корзина пуста и пока не готова к оформлению.");
      this.setSummaryHint("Добавьте хотя бы один товар, чтобы перейти к созданию заказа.");
      this.setStatus("Корзина пуста.");
      return;
    }

    this.list.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      fragment.append(createCartItem(item));
    });
    this.list.append(fragment);

    this.updateSummary(cart.item_count || 0, cart.total || 0, true);
    this.setSummaryState("Корзина готова к оформлению. Можно переходить к созданию заказа.");
    this.setSummaryHint("Проверьте количество товаров, затем переходите к оплате или продолжайте покупки.");
    this.setStatus(`В корзине ${cart.item_count || 0} товар(ов).`);
  }

  renderError() {
    if (!this.list) {
      return;
    }

    this.list.innerHTML = `
      <article class="empty-state empty-state--error">
        <h2 class="empty-state__title">Не удалось загрузить корзину</h2>
        <p class="empty-state__text">Проверьте, что backend и Redis доступны, затем попробуйте снова.</p>
        <div class="empty-state__actions">
          <button class="button button--ghost" type="button" data-cart-view-action="retry">Повторить загрузку</button>
          <a class="button button--ghost" href="./catalog.html">В каталог</a>
        </div>
      </article>
    `;

    this.updateSummary(0, 0, false);
    this.setSummaryState("Корзина временно недоступна.");
    this.setSummaryHint("Когда API снова ответит, здесь появятся сохраненные товары пользователя.");
    this.setStatus("Ошибка загрузки корзины.");
  }

  updateSummary(itemCount, total, hasItems) {
    if (this.countNode) {
      this.countNode.textContent = String(itemCount);
    }

    if (this.totalNode) {
      this.totalNode.textContent = formatCurrency(total);
    }

    if (this.clearButton) {
      this.clearButton.disabled = !hasItems;
    }

    if (this.checkoutButton) {
      this.checkoutButton.disabled = !hasItems;
    }
  }

  setSummaryState(message) {
    if (this.summaryStatusNode) {
      this.summaryStatusNode.textContent = message;
    }
  }

  setSummaryHint(message) {
    if (this.summaryHintNode) {
      this.summaryHintNode.textContent = message;
    }
  }

  async updateQuantity(itemNode, productId, quantity) {
    if (!productId || !itemNode) {
      return;
    }

    this.setItemBusy(itemNode, true);
    this.setSummaryState("Обновляем количество товара в корзине...");

    try {
      await cartService.updateItem(productId, quantity);
      await this.loadCart();

      if (quantity <= 0) {
        showToast("Товар удален из корзины");
      } else {
        showToast("Количество обновлено");
      }
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=cart.html";
        return;
      }

      showToast(error?.message || "Не удалось обновить корзину");
      await this.loadCart();
    } finally {
      this.setItemBusy(itemNode, false);
    }
  }

  async removeItem(itemNode, productId) {
    if (!productId || !itemNode) {
      return;
    }

    this.setItemBusy(itemNode, true);
    this.setSummaryState("Удаляем товар из корзины...");

    try {
      await cartService.removeItem(productId);
      await this.loadCart();
      showToast("Товар удален из корзины");
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=cart.html";
        return;
      }

      showToast(error?.message || "Не удалось удалить товар");
      this.setItemBusy(itemNode, false);
      this.setSummaryState("Не удалось удалить товар. Попробуйте еще раз.");
    }
  }

  async clearCart() {
    if (!this.clearButton) {
      return;
    }

    this.clearButton.disabled = true;
    this.setSummaryState("Очищаем корзину...");

    try {
      await cartService.clear();
      await this.loadCart();
      showToast("Корзина очищена");
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=cart.html";
        return;
      }

      showToast(error?.message || "Не удалось очистить корзину");
      await this.loadCart();
    }
  }

  async checkout() {
    if (!this.checkoutButton || this.checkoutButton.disabled) {
      return;
    }

    const originalText = this.checkoutButton.textContent;
    this.checkoutButton.disabled = true;
    this.checkoutButton.textContent = "Создаем заказ...";

    if (this.clearButton) {
      this.clearButton.disabled = true;
    }

    this.setSummaryState("Создаем заказ и готовим переход на оплату.");
    this.setStatus("Создаем заказ и подготавливаем переход на оплату...");

    try {
      const response = await orderService.createOrder();
      const orderId = response?.order_id;
      const paymentURL = response?.payment_url;

      showToast("Заказ создан");

      if (paymentURL) {
        this.setSummaryState(`Заказ #${orderId} создан. Перенаправляем на оплату.`);
        this.setStatus(`Заказ #${orderId} создан. Перенаправляем на оплату...`);
        window.location.assign(paymentURL);
        return;
      }

      this.setSummaryState(`Заказ #${orderId} создан. Переходим к истории заказов.`);
      this.setStatus(`Заказ #${orderId} создан. Переходим к истории заказов...`);
      window.location.assign(`./orders.html?created=${encodeURIComponent(orderId || "")}`);
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=cart.html";
        return;
      }

      const message = error?.message || "Не удалось создать заказ";
      showToast(message);
      this.setSummaryState("Не удалось создать заказ. Проверьте корзину и попробуйте снова.");
      this.setStatus("Ошибка при создании заказа.");
      await this.loadCart();
    } finally {
      if (this.checkoutButton) {
        this.checkoutButton.textContent = originalText;
      }
    }
  }

  setItemBusy(itemNode, isBusy) {
    itemNode.classList.toggle("cart-item--busy", isBusy);
    itemNode.querySelectorAll("button, input").forEach((control) => {
      control.disabled = isBusy;
    });
  }
}

new CartPage().init();
