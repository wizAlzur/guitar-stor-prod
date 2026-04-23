import { showToast } from "../components/toast.js";
import { getOrderStatusLabel, getOrderStatusModifier } from "../components/order-card.js";
import { BasePage } from "../core/base-page.js";
import { tokenStorage } from "../core/storage.js";
import { orderService } from "../services/order-service.js";
import { formatCurrency, formatDate } from "./format.js";

const POLL_INTERVAL_MS = 1800;
const MAX_ATTEMPTS = 4;
const FINAL_STATUSES = new Set(["paid", "canceled"]);

function sleep(timeout) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, timeout);
  });
}

function countItems(order) {
  return (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function buildOrdersLink(orderId) {
  if (!orderId) {
    return "./orders.html";
  }

  return `./orders.html?created=${encodeURIComponent(String(orderId))}`;
}

function buildAuthLink(pageFile, orderId) {
  const redirect = orderId ? `${pageFile}?order_id=${encodeURIComponent(String(orderId))}` : pageFile;
  return `./auth.html?redirect=${encodeURIComponent(redirect)}`;
}

function getActions(status, orderId) {
  switch (status) {
    case "paid":
      return {
        primary: { href: buildOrdersLink(orderId), label: "К заказу" },
        secondary: { href: "./catalog.html", label: "В каталог" }
      };
    case "pending":
      return {
        primary: { href: buildOrdersLink(orderId), label: "Проверить заказ" },
        secondary: { href: "./catalog.html", label: "Продолжить покупки" }
      };
    default:
      return {
        primary: { href: "./cart.html", label: "Вернуться в корзину" },
        secondary: { href: buildOrdersLink(orderId), label: "К заказу" }
      };
  }
}

function getSupportContent(status, kind) {
  if (status === "paid") {
    return {
      title: "Что дальше",
      text: "Оплата подтверждена. Теперь пользователю удобнее всего перейти к самому заказу или продолжить покупки.",
      points: [
        "Откройте заказ и проверьте его состав в истории заказов.",
        "Сохраните номер заказа для демонстрации на защите.",
        "Если нужно, вернитесь в каталог и продолжайте покупки."
      ]
    };
  }

  if (status === "canceled") {
    return {
      title: "Как продолжить",
      text: "Заказ сохранился в истории, но оплата не завершилась. Сценарий можно повторить позже.",
      points: [
        "Вернитесь в корзину или каталог и соберите новый заказ.",
        "Проверьте текущий статус заказа в истории заказов.",
        "Если оплата сорвалась случайно, повторите попытку позже."
      ]
    };
  }

  return {
    title: kind === "fail" ? "Если статус еще не обновился" : "Почему статус может задержаться",
    text: "После возврата со страницы оплаты подтверждение иногда приходит на backend чуть позже самого пользователя.",
    points: [
      "Подождите несколько секунд и откройте заказ снова.",
      "Проверьте историю заказов: там виден актуальный статус.",
      "Если статус долго не меняется, повторите проверку позже."
    ]
  };
}

function getScenario(kind, status, orderId) {
  if (status === "paid") {
    return {
      theme: "success",
      title: "Платеж подтвержден",
      message:
        kind === "fail"
          ? `Заказ #${orderId} уже успел перейти в оплаченный статус. Значит, подтверждение от платежного сервиса дошло до backend.`
          : `Оплата по заказу #${orderId} подтверждена. Можно открыть заказ и посмотреть его детали.`,
      statusLine: `Заказ #${orderId} оплачен и передан в обработку.`,
      actions: getActions("paid", orderId)
    };
  }

  if (status === "canceled") {
    return {
      theme: "fail",
      title: "Платеж не завершен",
      message:
        kind === "success"
          ? `Пользователь вернулся со страницы оплаты, но заказ #${orderId} в итоге отмечен как отмененный. Можно повторить попытку оплаты позже.`
          : `Заказ #${orderId} сохранен, но оплата была отменена или не завершилась.`,
      statusLine: `Заказ #${orderId} сейчас имеет статус "Отменен".`,
      actions: getActions("canceled", orderId)
    };
  }

  return {
    theme: "pending",
    title: kind === "fail" ? "Статус платежа уточняется" : "Проверяем статус платежа",
    message:
      kind === "fail"
        ? `Финальный статус по заказу #${orderId} пока не подтвержден. Возможно, webhook еще в пути от YooKassa к backend.`
        : `Заказ #${orderId} уже создан, но подтверждение оплаты еще не успело обновить его статус.`,
    statusLine: `Заказ #${orderId} пока остается в статусе "Ожидает оплаты".`,
    actions: getActions("pending", orderId)
  };
}

export class PaymentResultPage extends BasePage {
  constructor({ kind, pageName, pageFile }) {
    super({ pageName });
    this.kind = kind;
    this.pageFile = pageFile;
    this.root = null;
    this.titleNode = null;
    this.messageNode = null;
    this.badgeNode = null;
    this.metaNode = null;
    this.primaryAction = null;
    this.secondaryAction = null;
    this.supportTitleNode = null;
    this.supportTextNode = null;
    this.supportListNode = null;
  }

  async init() {
    if (!this.mount()) {
      return;
    }

    this.cacheElements();
    if (!this.root || !this.titleNode || !this.messageNode) {
      return;
    }

    const orderId = this.resolveOrderId();
    this.renderBootState(orderId);

    if (!orderId) {
      this.renderMissingOrder();
      return;
    }

    if (!tokenStorage.hasToken()) {
      this.renderAuthRequired(orderId, false);
      return;
    }

    await this.loadOrder(orderId);
  }

  cacheElements() {
    this.root = document.querySelector("[data-payment-root]");
    this.titleNode = document.querySelector("[data-payment-title]");
    this.messageNode = document.querySelector("[data-payment-message]");
    this.badgeNode = document.querySelector("[data-payment-badge]");
    this.metaNode = document.querySelector("[data-payment-meta]");
    this.primaryAction = document.querySelector("[data-payment-primary]");
    this.secondaryAction = document.querySelector("[data-payment-secondary]");
    this.supportTitleNode = document.querySelector("[data-payment-support-title]");
    this.supportTextNode = document.querySelector("[data-payment-support-text]");
    this.supportListNode = document.querySelector("[data-payment-support-list]");
  }

  resolveOrderId() {
    const params = new URLSearchParams(window.location.search);
    const rawValue = Number(params.get("order_id"));
    return Number.isInteger(rawValue) && rawValue > 0 ? rawValue : null;
  }

  async loadOrder(orderId) {
    let latestOrder = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const order = await orderService.getOrder(orderId);
        latestOrder = order;

        const shouldContinuePolling =
          order?.status === "pending" && attempt < MAX_ATTEMPTS && !FINAL_STATUSES.has(order?.status);

        this.renderOrder(order, shouldContinuePolling);

        if (!shouldContinuePolling) {
          return;
        }

        await sleep(POLL_INTERVAL_MS);
      } catch (error) {
        console.error(error);

        if (error?.status === 401) {
          showToast("Нужно войти снова, чтобы увидеть актуальный статус заказа");
          this.renderAuthRequired(orderId, true);
          return;
        }

        this.renderError(orderId, error?.message);
        return;
      }
    }

    if (latestOrder) {
      this.renderOrder(latestOrder, false);
    }
  }

  renderBootState(orderId) {
    this.applyTheme("pending");
    this.updateBadge("pending");
    this.titleNode.textContent =
      this.kind === "fail" ? "Проверяем, обновился ли заказ" : "Проверяем статус платежа";
    this.messageNode.textContent = orderId
      ? `Связываем возврат с заказом #${orderId} и запрашиваем его актуальный статус.`
      : "Пробуем понять, к какому заказу относится возврат со страницы оплаты.";
    this.renderMeta(null);
    this.renderSupport({
      title: "Что сейчас происходит",
      text: "Страница запрашивает заказ из API и сравнивает фактический статус оплаты.",
      points: [
        "Если статус уже финальный, он появится сразу.",
        "Если статус еще pending, страница подождет несколько секунд и проверит снова."
      ]
    });
    this.setStatus("Получаем актуальные данные по заказу...");
  }

  renderOrder(order, isPolling) {
    const scenario = getScenario(this.kind, order?.status, order?.id);
    this.applyTheme(scenario.theme);
    this.updateBadge(order?.status);
    this.titleNode.textContent = scenario.title;
    this.messageNode.textContent = scenario.message;
    this.renderMeta(order);
    this.updateActions(scenario.actions);
    this.renderSupport(getSupportContent(order?.status, this.kind));

    if (order?.status === "pending" && isPolling) {
      this.setStatus("Заказ создан. Ждем подтверждение оплаты еще несколько секунд...");
      return;
    }

    if (order?.status === "pending") {
      this.setStatus(
        "Заказ сохранен, но финальный статус оплаты еще не пришел. Его можно открыть позже в истории заказов."
      );
      return;
    }

    this.setStatus(scenario.statusLine);
  }

  renderMissingOrder() {
    this.applyTheme("pending");
    this.updateBadge("pending");
    this.titleNode.textContent = "Не удалось определить заказ";
    this.messageNode.textContent =
      "В адресе возврата нет параметра order_id, поэтому страница не может показать фактический статус оплаты.";
    this.renderMeta(null);
    this.renderSupport({
      title: "Что можно сделать",
      text: "Самый надежный путь в этом случае — открыть историю заказов и проверить последний заказ вручную.",
      points: [
        "Перейдите в историю заказов.",
        "Откройте последний заказ пользователя.",
        "Сверьте его статус и сумму."
      ]
    });
    this.updateActions({
      primary: { href: "./orders.html", label: "К заказам" },
      secondary: { href: "./catalog.html", label: "В каталог" }
    });
    this.setStatus("Откройте историю заказов вручную и проверьте последний заказ.");
  }

  renderAuthRequired(orderId, isExpired) {
    this.applyTheme("pending");
    this.updateBadge("pending");
    this.titleNode.textContent = "Нужно войти, чтобы проверить статус";
    this.messageNode.textContent = isExpired
      ? `Токен для заказа #${orderId} больше не действует. После повторного входа страница сразу покажет актуальный статус.`
      : `Возврат со страницы оплаты получен, но без авторизации нельзя запросить детали заказа #${orderId} у API.`;
    this.renderMeta(null);
    this.renderSupport({
      title: "Почему нужен вход",
      text: "Заказ относится к конкретному пользователю, поэтому API отдает его только авторизованному клиенту.",
      points: [
        "Войдите в аккаунт снова.",
        "После входа страница вернет вас к проверке статуса заказа.",
        "Если нужно, потом можно перейти в историю заказов."
      ]
    });
    this.updateActions({
      primary: { href: buildAuthLink(this.pageFile, orderId), label: "Войти и проверить" },
      secondary: { href: "./catalog.html", label: "В каталог" }
    });
    this.setStatus("Авторизуйтесь, чтобы страница смогла получить заказ из API.");
  }

  renderError(orderId, message) {
    this.applyTheme("pending");
    this.updateBadge("pending");
    this.titleNode.textContent = "Не удалось проверить статус заказа";
    this.messageNode.textContent =
      message || `API не вернул данные по заказу #${orderId}. Попробуйте открыть его снова чуть позже.`;
    this.renderMeta(null);
    this.renderSupport({
      title: "Если статус недоступен",
      text: "Даже если экран не смог показать результат, сам заказ обычно уже сохранен на backend.",
      points: [
        "Откройте историю заказов и проверьте заказ вручную.",
        "Если нужно, повторите проверку немного позже.",
        "При временной ошибке сервера просто обновите страницу."
      ]
    });
    this.updateActions({
      primary: { href: buildOrdersLink(orderId), label: "Открыть заказ" },
      secondary: { href: "./catalog.html", label: "В каталог" }
    });
    this.setStatus("Статус оплаты пока недоступен.");
  }

  renderMeta(order) {
    if (!this.metaNode) {
      return;
    }

    if (!order) {
      this.metaNode.hidden = true;
      this.metaNode.innerHTML = "";
      return;
    }

    this.metaNode.hidden = false;
    this.metaNode.innerHTML = `
      <div class="payment-result__meta-row">
        <dt>Заказ</dt>
        <dd>#${order.id}</dd>
      </div>
      <div class="payment-result__meta-row">
        <dt>Статус</dt>
        <dd>${getOrderStatusLabel(order.status)}</dd>
      </div>
      <div class="payment-result__meta-row">
        <dt>Сумма</dt>
        <dd>${formatCurrency(order.total_amount)}</dd>
      </div>
      <div class="payment-result__meta-row">
        <dt>Дата</dt>
        <dd>${formatDate(order.created_at)}</dd>
      </div>
      <div class="payment-result__meta-row">
        <dt>Товаров</dt>
        <dd>${countItems(order)}</dd>
      </div>
    `;
  }

  renderSupport(content) {
    if (this.supportTitleNode) {
      this.supportTitleNode.textContent = content.title;
    }

    if (this.supportTextNode) {
      this.supportTextNode.textContent = content.text;
    }

    if (this.supportListNode) {
      this.supportListNode.innerHTML = (content.points || [])
        .map((point) => `<li class="payment-result__support-item">${point}</li>`)
        .join("");
    }
  }

  updateBadge(status) {
    if (!this.badgeNode) {
      return;
    }

    this.badgeNode.className = `payment-result__badge order-card__status ${getOrderStatusModifier(status)}`;
    this.badgeNode.textContent = getOrderStatusLabel(status);
  }

  updateActions(actions) {
    if (this.primaryAction && actions?.primary) {
      this.primaryAction.href = actions.primary.href;
      this.primaryAction.textContent = actions.primary.label;
    }

    if (this.secondaryAction && actions?.secondary) {
      this.secondaryAction.href = actions.secondary.href;
      this.secondaryAction.textContent = actions.secondary.label;
    }
  }

  applyTheme(theme) {
    if (!this.root) {
      return;
    }

    this.root.classList.remove(
      "payment-result--success",
      "payment-result--fail",
      "payment-result--pending"
    );
    this.root.classList.add(`payment-result--${theme}`);
  }
}
