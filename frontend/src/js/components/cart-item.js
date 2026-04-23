import { formatCurrency } from "../shared/format.js";

export function createCartItem(item) {
  const article = document.createElement("article");
  article.className = "cart-item";
  article.dataset.productId = String(item.product_id);

  article.innerHTML = `
    <div class="cart-item__info">
      <p class="cart-item__name">${item.name}</p>
      <p class="cart-item__meta">${item.description || "Товар из вашей корзины"}</p>
      <p class="cart-item__unit">Цена за штуку: ${formatCurrency(item.price)}</p>
    </div>
    <div class="cart-item__side">
      <div class="quantity-control">
        <button class="quantity-control__button" type="button" data-cart-action="decrease" data-product-id="${item.product_id}">
          -
        </button>
        <input
          class="quantity-control__input"
          type="number"
          min="0"
          step="1"
          value="${item.quantity}"
          data-cart-quantity
          data-product-id="${item.product_id}"
          aria-label="Количество товара ${item.name}"
        />
        <button class="quantity-control__button" type="button" data-cart-action="increase" data-product-id="${item.product_id}">
          +
        </button>
      </div>
      <strong class="cart-item__price">${formatCurrency(item.subtotal)}</strong>
      <button class="button button--ghost button--small" type="button" data-cart-action="remove" data-product-id="${item.product_id}">
        Удалить
      </button>
    </div>
  `;

  return article;
}

export function createCartItemSkeleton() {
  const article = document.createElement("article");
  article.className = "cart-item cart-item--loading";
  article.setAttribute("aria-hidden", "true");

  article.innerHTML = `
    <div class="cart-item__info">
      <span class="cart-item__skeleton cart-item__skeleton--title"></span>
      <span class="cart-item__skeleton"></span>
      <span class="cart-item__skeleton cart-item__skeleton--short"></span>
    </div>
    <div class="cart-item__side">
      <span class="cart-item__skeleton cart-item__skeleton--control"></span>
      <span class="cart-item__skeleton cart-item__skeleton--price"></span>
      <span class="cart-item__skeleton cart-item__skeleton--button"></span>
    </div>
  `;

  return article;
}
