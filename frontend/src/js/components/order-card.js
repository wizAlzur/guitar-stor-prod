import { formatCurrency, formatDate } from "../shared/format.js";

export function getOrderStatusLabel(status) {
  switch (status) {
    case "paid":
      return "Оплачен";
    case "canceled":
      return "Отменен";
    case "pending":
      return "Ожидает оплаты";
    default:
      return status || "Неизвестно";
  }
}

export function getOrderStatusModifier(status) {
  switch (status) {
    case "paid":
      return " order-card__status--paid";
    case "canceled":
      return " order-card__status--canceled";
    default:
      return " order-card__status--pending";
  }
}

function getOrderStatusHint(status) {
  switch (status) {
    case "paid":
      return "Оплата подтверждена, заказ уже передан в обработку.";
    case "canceled":
      return "Оплата не завершилась. При необходимости можно собрать корзину заново.";
    case "pending":
      return "Финальный статус оплаты еще может обновиться через webhook.";
    default:
      return "Статус заказа уточняется.";
  }
}

function countItems(order) {
  return (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function getDetailActions(status) {
  switch (status) {
    case "paid":
      return [
        { href: "./catalog.html", label: "Продолжить покупки", tone: "primary" },
        { href: "./cart.html", label: "Открыть корзину", tone: "ghost" }
      ];
    case "canceled":
      return [
        { href: "./cart.html", label: "Вернуться в корзину", tone: "primary" },
        { href: "./catalog.html", label: "В каталог", tone: "ghost" }
      ];
    default:
      return [
        { href: "./catalog.html", label: "В каталог", tone: "primary" },
        { href: "./cart.html", label: "Проверить корзину", tone: "ghost" }
      ];
  }
}

export function createOrderCard(order) {
  const article = document.createElement("article");
  article.className = "order-card";
  article.dataset.orderId = String(order.id);

  article.innerHTML = `
    <div class="order-card__head">
      <strong>Заказ #${order.id}</strong>
      <span class="order-card__status${getOrderStatusModifier(order.status)}">${getOrderStatusLabel(order.status)}</span>
    </div>
    <p class="order-card__meta">Создан ${formatDate(order.created_at)}</p>
    <p class="order-card__hint">${getOrderStatusHint(order.status)}</p>
    <p class="order-card__sum">${formatCurrency(order.total_amount)}</p>
    <button class="button button--ghost button--small" type="button" data-order-action="details" data-order-id="${order.id}">
      Подробнее
    </button>
  `;

  return article;
}

export function createOrderCardSkeleton() {
  const article = document.createElement("article");
  article.className = "order-card order-card--loading";
  article.setAttribute("aria-hidden", "true");

  article.innerHTML = `
    <span class="order-card__skeleton order-card__skeleton--title"></span>
    <span class="order-card__skeleton"></span>
    <span class="order-card__skeleton order-card__skeleton--sum"></span>
    <span class="order-card__skeleton order-card__skeleton--button"></span>
  `;

  return article;
}

export function createOrderDetails(order) {
  const wrapper = document.createElement("section");
  wrapper.className = "order-details";

  const itemsMarkup = (order.items || [])
    .map((item) => {
      return `
        <article class="order-details__item">
          <div>
            <p class="order-details__item-name">${item.name}</p>
            <p class="order-details__item-meta">${item.quantity} шт. × ${formatCurrency(item.price)}</p>
          </div>
          <strong class="order-details__item-sum">${formatCurrency(item.subtotal)}</strong>
        </article>
      `;
    })
    .join("");

  const actionsMarkup = getDetailActions(order.status)
    .map((action) => {
      const modifier = action.tone === "primary" ? "button--primary" : "button--ghost";
      return `<a class="button ${modifier}" href="${action.href}">${action.label}</a>`;
    })
    .join("");

  wrapper.innerHTML = `
    <div class="order-details__head">
      <div>
        <p class="section-label">Детали заказа</p>
        <h2 class="order-details__title">Заказ #${order.id}</h2>
      </div>
      <span class="order-card__status${getOrderStatusModifier(order.status)}">${getOrderStatusLabel(order.status)}</span>
    </div>

    <p class="order-details__lead">${getOrderStatusHint(order.status)}</p>

    <dl class="order-details__meta">
      <div class="order-details__row">
        <dt>Создан</dt>
        <dd>${formatDate(order.created_at)}</dd>
      </div>
      <div class="order-details__row">
        <dt>Позиции</dt>
        <dd>${countItems(order)}</dd>
      </div>
      <div class="order-details__row">
        <dt>Итого</dt>
        <dd>${formatCurrency(order.total_amount)}</dd>
      </div>
    </dl>

    <div class="order-details__items">
      ${itemsMarkup || '<p class="order-details__empty">У этого заказа пока нет отображаемых позиций.</p>'}
    </div>

    <div class="order-details__actions">
      ${actionsMarkup}
    </div>
  `;

  return wrapper;
}
