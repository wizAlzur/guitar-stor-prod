import {
  createOrderCard,
  createOrderCardSkeleton,
  createOrderDetails,
  getOrderStatusLabel
} from "../components/order-card.js";
import { showToast } from "../components/toast.js";
import { BasePage } from "../core/base-page.js";
import { orderService } from "../services/order-service.js";

function countItems(order) {
  return (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
}

class OrdersPage extends BasePage {
  constructor() {
    super({ pageName: "orders", requireAuth: true });
    this.orders = [];
    this.list = null;
    this.details = null;
    this.summaryStatusNode = null;
    this.selectionSummaryNode = null;
    this.selectedOrderId = null;
    this.createdOrderId = null;
  }

  async init() {
    if (!this.mount()) {
      return;
    }

    this.cacheElements();
    if (!this.list || !this.details) {
      return;
    }

    this.createdOrderId = this.resolveCreatedOrderId();
    this.bindActions();
    this.renderLoading();
    await this.loadOrders();
  }

  cacheElements() {
    this.list = document.querySelector("[data-orders-list]");
    this.details = document.querySelector("[data-order-details]");
    this.summaryStatusNode = document.querySelector("[data-orders-summary-status]");
    this.selectionSummaryNode = document.querySelector("[data-order-selection-summary]");
  }

  bindActions() {
    this.list.addEventListener("click", async (event) => {
      const detailsButton = event.target.closest('[data-order-action="details"]');
      if (detailsButton) {
        const orderId = Number(detailsButton.dataset.orderId);
        if (orderId) {
          await this.loadOrderDetails(orderId);
        }
        return;
      }

      const action = event.target.closest("[data-orders-action]");
      if (!action) {
        return;
      }

      if (action.dataset.ordersAction === "retry") {
        this.renderLoading();
        await this.loadOrders();
      }
    });

    this.details.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-orders-action]");
      if (!action) {
        return;
      }

      if (action.dataset.ordersAction === "retry-details") {
        const orderId = Number(action.dataset.orderId || this.selectedOrderId);
        if (orderId) {
          await this.loadOrderDetails(orderId);
        }
      }
    });
  }

  resolveCreatedOrderId() {
    const params = new URLSearchParams(window.location.search);
    const orderId = Number(params.get("created"));
    return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
  }

  async loadOrders() {
    try {
      const orders = await orderService.listOrders();
      this.orders = Array.isArray(orders) ? orders : [];
      this.renderOrders();

      const initialOrderId = this.createdOrderId || this.orders[0]?.id;

      if (initialOrderId) {
        await this.loadOrderDetails(initialOrderId);

        if (this.createdOrderId && this.orders.some((order) => order.id === this.createdOrderId)) {
          showToast(`Заказ #${this.createdOrderId} создан`);
          this.setSummaryState(`Новый заказ #${this.createdOrderId} выделен и открыт первым.`);
        }
      } else {
        this.renderEmptyDetails();
      }
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=orders.html";
        return;
      }

      this.renderError();
    }
  }

  async loadOrderDetails(orderId) {
    try {
      this.selectedOrderId = orderId;
      this.highlightSelectedOrder();
      this.renderDetailsLoading();

      const order = await orderService.getOrder(orderId);
      this.renderOrderDetails(order);
      this.setSelectionSummary(
        `Сейчас открыт заказ #${order.id}: статус "${getOrderStatusLabel(order.status)}", позиций ${countItems(order)}, сумма ${order.total_amount}.`
      );
      this.setStatus(`Показаны детали заказа #${orderId}.`);
    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        showToast("Сессия истекла, войдите снова");
        window.location.href = "./auth.html?redirect=orders.html";
        return;
      }

      this.details.innerHTML = `
        <article class="empty-state empty-state--error">
          <h2 class="empty-state__title">Не удалось загрузить заказ</h2>
          <p class="empty-state__text">Попробуйте открыть выбранный заказ еще раз немного позже.</p>
          <div class="empty-state__actions">
            <button class="button button--ghost" type="button" data-orders-action="retry-details" data-order-id="${orderId}">
              Повторить
            </button>
          </div>
        </article>
      `;
      this.setSelectionSummary("Детали заказа временно недоступны. Можно повторить запрос чуть позже.");
    }
  }

  renderLoading() {
    this.list.innerHTML = "";

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 3; index += 1) {
      fragment.append(createOrderCardSkeleton());
    }

    this.list.append(fragment);
    this.details.innerHTML = `
      <article class="empty-state">
        <h2 class="empty-state__title">Загружаем детали</h2>
        <p class="empty-state__text">Сначала получим список заказов пользователя, а затем откроем первый доступный заказ.</p>
      </article>
    `;
    this.setSummaryState("Загружаем историю заказов и ищем актуальный заказ пользователя.");
    this.setSelectionSummary("После загрузки здесь появится краткая сводка по выбранной покупке.");
    this.setStatus("Загружаем историю заказов...");
  }

  renderOrders() {
    if (!this.orders.length) {
      this.list.innerHTML = `
        <article class="empty-state">
          <h2 class="empty-state__title">Заказов пока нет</h2>
          <p class="empty-state__text">Оформите первую покупку, и она появится в этой истории.</p>
          <div class="empty-state__actions">
            <a class="button button--primary" href="./catalog.html">Перейти в каталог</a>
            <a class="button button--ghost" href="./cart.html">Открыть корзину</a>
          </div>
        </article>
      `;
      this.setSummaryState("История заказов пуста. Первый оформленный заказ появится здесь автоматически.");
      this.setSelectionSummary("Пока заказов нет, поэтому справа нечего показывать.");
      this.setStatus("История заказов пуста.");
      return;
    }

    this.list.innerHTML = "";
    const fragment = document.createDocumentFragment();

    this.orders.forEach((order) => {
      fragment.append(createOrderCard(order));
    });

    this.list.append(fragment);
    this.highlightSelectedOrder();
    this.setSummaryState(`Загружено ${this.orders.length} заказ(ов). Можно переключаться между ними и смотреть детали справа.`);
    this.setStatus(`Загружено ${this.orders.length} заказ(ов).`);
  }

  renderOrderDetails(order) {
    this.details.innerHTML = "";
    this.details.append(createOrderDetails(order));
  }

  renderDetailsLoading() {
    this.details.innerHTML = `
      <article class="empty-state">
        <h2 class="empty-state__title">Загружаем детали заказа</h2>
        <p class="empty-state__text">Получаем список товаров, итоговую сумму и фактический статус выбранной покупки.</p>
      </article>
    `;
    this.setSelectionSummary("Получаем свежие детали выбранного заказа.");
  }

  renderEmptyDetails() {
    this.details.innerHTML = `
      <article class="empty-state">
        <h2 class="empty-state__title">Пока нечего показывать</h2>
        <p class="empty-state__text">Когда у пользователя появятся заказы, здесь будут их подробности.</p>
      </article>
    `;
  }

  renderError() {
    this.list.innerHTML = `
      <article class="empty-state empty-state--error">
        <h2 class="empty-state__title">Не удалось загрузить историю заказов</h2>
        <p class="empty-state__text">Проверьте, что backend доступен и токен пользователя действителен.</p>
        <div class="empty-state__actions">
          <button class="button button--ghost" type="button" data-orders-action="retry">Повторить загрузку</button>
          <a class="button button--ghost" href="./catalog.html">В каталог</a>
        </div>
      </article>
    `;

    this.renderEmptyDetails();
    this.setSummaryState("История заказов временно недоступна.");
    this.setSelectionSummary("Когда API снова ответит, здесь появится сводка по выбранному заказу.");
    this.setStatus("Ошибка загрузки истории заказов.");
  }

  setSummaryState(message) {
    if (this.summaryStatusNode) {
      this.summaryStatusNode.textContent = message;
    }
  }

  setSelectionSummary(message) {
    if (this.selectionSummaryNode) {
      this.selectionSummaryNode.textContent = message;
    }
  }

  highlightSelectedOrder() {
    this.list.querySelectorAll("[data-order-id]").forEach((node) => {
      const isSelected = Number(node.dataset.orderId) === this.selectedOrderId;
      node.classList.toggle("order-card--selected", isSelected);
    });
  }
}

new OrdersPage().init();
