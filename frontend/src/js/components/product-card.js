import guitarPlaceholderUrl from "../../assets/guitar-placeholder.svg";
import { formatCurrency } from "../shared/format.js";

function getStockLabel(inventory) {
  if (inventory <= 0) {
    return "Нет в наличии";
  }

  if (inventory <= 3) {
    return `Осталось ${inventory} шт.`;
  }

  return "В наличии";
}

function getStockModifier(inventory) {
  if (inventory <= 0) {
    return " stock-badge--empty";
  }

  if (inventory <= 3) {
    return " stock-badge--warning";
  }

  return " stock-badge--available";
}

export function createProductCard(product, options = {}) {
  const article = document.createElement("article");
  article.className = "product-card";
  article.dataset.productId = String(product.id);

  const description =
    product.description?.trim() || "Описание товара появится после наполнения каталога.";
  const imageSrc = product.image_url?.trim() || guitarPlaceholderUrl;
  const imageAlt = product.name ? `${product.name} — изображение товара` : "Изображение товара";

  const actionLabel =
    options.actionLabel || (product.inventory > 0 ? "В корзину" : "Нет в наличии");
  const actionDisabled =
    options.actionDisabled !== undefined ? options.actionDisabled : product.inventory <= 0;
  const actionName = options.actionName || "";
  const actionAttrs = actionName
    ? `data-product-action="${actionName}" data-product-id="${product.id}"`
    : "";

  article.innerHTML = `
    <div class="product-card__media">
      <img
        class="product-card__image"
        src="${imageSrc}"
        alt="${imageAlt}"
        loading="lazy"
      />
      <div class="product-card__media-glow"></div>
      <div class="product-card__media-label">#${product.id}</div>
    </div>
    <div class="product-card__body">
      <div class="product-card__top">
        <span class="stock-badge${getStockModifier(product.inventory)}">${getStockLabel(product.inventory)}</span>
      </div>
      <h2 class="product-card__title">${product.name}</h2>
      <p class="product-card__text">${description}</p>
      <div class="product-card__footer">
        <span class="price-tag">${formatCurrency(product.price)}</span>
        <button
          class="button button--secondary"
          type="button"
          ${actionDisabled ? "disabled" : ""}
          ${actionAttrs}
        >
          ${actionLabel}
        </button>
      </div>
    </div>
  `;

  return article;
}

export function createProductCardSkeleton() {
  const article = document.createElement("article");
  article.className = "product-card product-card--loading";
  article.setAttribute("aria-hidden", "true");

  article.innerHTML = `
    <div class="product-card__media">
      <div class="product-card__media-glow"></div>
    </div>
    <div class="product-card__body">
      <div class="product-card__top">
        <span class="product-card__skeleton-chip"></span>
      </div>
      <span class="product-card__skeleton-line product-card__skeleton-line--title"></span>
      <span class="product-card__skeleton-line"></span>
      <span class="product-card__skeleton-line product-card__skeleton-line--short"></span>
      <div class="product-card__footer">
        <span class="product-card__skeleton-line product-card__skeleton-line--price"></span>
        <span class="product-card__skeleton-button"></span>
      </div>
    </div>
  `;

  return article;
}