import { APP_ENV } from "../core/env.js";
import { tokenStorage } from "../core/storage.js";

const navItems = [
  { key: "home", href: "./index.html", label: "Главная" },
  { key: "catalog", href: "./catalog.html", label: "Каталог" },
  { key: "cart", href: "./cart.html", label: "Корзина" },
  { key: "orders", href: "./orders.html", label: "Заказы" }
];

function createNavMarkup(currentPage) {
  return navItems
    .map((item) => {
      const activeClass = item.key === currentPage ? " nav__link--active" : "";
      return `<a class="nav__link${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function getCurrentPageTarget() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const search = window.location.search || "";
  return `${path}${search}`;
}

function buildAuthHref(mode = "login") {
  if (window.location.pathname.endsWith("auth.html")) {
    return mode === "register" ? "./auth.html?mode=register" : "./auth.html";
  }

  const redirect = encodeURIComponent(getCurrentPageTarget());
  return mode === "register"
    ? `./auth.html?mode=register&redirect=${redirect}`
    : `./auth.html?redirect=${redirect}`;
}

function createUserPanelMarkup() {
  if (tokenStorage.hasToken()) {
    return `
      <div class="user-panel__group">
        <span class="user-panel__badge">Аккаунт активен</span>
        <a class="button button--small button--ghost" href="./orders.html">Мои заказы</a>
        <button class="button button--small button--ghost" type="button" data-action="logout">Выйти</button>
      </div>
    `;
  }

  return `
    <div class="user-panel__group">
      <a class="button button--small button--ghost" href="${buildAuthHref("login")}">Войти</a>
      <a class="button button--small button--primary" href="${buildAuthHref("register")}">Регистрация</a>
    </div>
  `;
}

export function renderShell({ currentPage }) {
  const header = document.querySelector('[data-shell="header"]');
  const footer = document.querySelector('[data-shell="footer"]');

  if (header) {
    header.innerHTML = `
      <div class="container header__container">
        <a class="logo" href="./index.html">
          <span class="logo__mark">SS</span>
          <span class="logo__text">${APP_ENV.appName}</span>
        </a>
        <nav class="nav" aria-label="Основная навигация">
          ${createNavMarkup(currentPage)}
        </nav>
        <div class="user-panel">
          ${createUserPanelMarkup()}
        </div>
      </div>
    `;

    const logoutButton = header.querySelector('[data-action="logout"]');
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        tokenStorage.clear();
        window.location.replace("./index.html");
      });
    }
  }

  if (footer) {
    footer.innerHTML = `
      <div class="container footer__container">
        <div>
          <p class="footer__title">${APP_ENV.appName}</p>
          <p class="footer__text">Курсовой проект: интернет-магазин гитар с каталогом, корзиной, заказами и онлайн-оплатой.</p>
        </div>
        <div class="footer__meta">
          <a class="footer__link" href="./catalog.html">Перейти в каталог</a>
          <a class="footer__link" href="./orders.html">История заказов</a>
        </div>
      </div>
    `;
  }
}
