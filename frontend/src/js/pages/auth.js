import { showToast } from "../components/toast.js";
import { BasePage } from "../core/base-page.js";
import { authService } from "../services/auth-service.js";
import { queryAll } from "../shared/dom.js";

const REDIRECT_LABELS = {
  "index.html": "на главную страницу",
  "catalog.html": "в каталог",
  "cart.html": "в корзину",
  "orders.html": "в раздел заказов",
  "payment-success.html": "на страницу результата оплаты",
  "payment-fail.html": "на страницу результата оплаты"
};

class AuthPage extends BasePage {
  constructor() {
    super({ pageName: "auth" });
    this.mode = "login";
    this.form = null;
    this.emailInput = null;
    this.passwordInput = null;
    this.confirmGroup = null;
    this.confirmInput = null;
    this.submitButton = null;
    this.feedbackNode = null;
    this.hintNode = null;
    this.redirectNode = null;
    this.fieldErrors = new Map();
    this.redirectMeta = {
      target: "./catalog.html",
      destinationText: "в каталог"
    };
  }

  init() {
    if (!this.mount()) {
      return;
    }

    this.cacheElements();
    this.redirectMeta = this.resolveRedirectTarget();
    this.bindTabs();
    this.bindForm();
    this.bindValidation();
    this.bindPasswordToggles();
    this.setInitialMode();
    this.renderRedirectHint();

    if (authService.isAuthenticated()) {
      this.setStatus(
        `Вы уже авторизованы. После повторного входа можем сразу вернуть вас ${this.redirectMeta.destinationText}.`
      );
      return;
    }

    this.setStatus("Войдите в аккаунт, чтобы пользоваться корзиной и оформлять заказы.");
  }

  cacheElements() {
    this.form = document.querySelector("[data-auth-form]");
    this.emailInput = document.querySelector("[data-auth-email]");
    this.passwordInput = document.querySelector("[data-auth-password]");
    this.confirmGroup = document.querySelector("[data-auth-confirm-group]");
    this.confirmInput = document.querySelector("[data-auth-confirm]");
    this.submitButton = document.querySelector("[data-auth-submit]");
    this.feedbackNode = document.querySelector("[data-auth-feedback]");
    this.hintNode = document.querySelector("[data-auth-hint]");
    this.redirectNode = document.querySelector("[data-auth-redirect]");

    queryAll("[data-field-error-for]").forEach((node) => {
      this.fieldErrors.set(node.dataset.fieldErrorFor, node);
    });
  }

  bindTabs() {
    queryAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => this.setMode(button.dataset.authMode));
    });
  }

  bindForm() {
    if (!this.form) {
      return;
    }

    this.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.handleSubmit();
    });
  }

  bindValidation() {
    [this.emailInput, this.passwordInput, this.confirmInput]
      .filter(Boolean)
      .forEach((input) => {
        input.addEventListener("input", () => {
          if (input === this.emailInput) {
            this.emailInput.value = this.emailInput.value.replace(/\s+/g, "");
          }

          this.validateField(input);

          if (input === this.passwordInput && this.mode === "register" && this.confirmInput?.value) {
            this.validateField(this.confirmInput);
          }
        });

        input.addEventListener("blur", () => {
          if (input === this.emailInput) {
            this.emailInput.value = this.normalizeEmail(this.emailInput.value);
          }

          this.validateField(input);
        });
      });
  }

  bindPasswordToggles() {
    queryAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.querySelector(button.dataset.passwordToggle);
        if (!target) {
          return;
        }

        const willShow = target.type === "password";
        target.type = willShow ? "text" : "password";
        button.textContent = willShow ? "Скрыть" : "Показать";
        button.setAttribute("aria-pressed", String(willShow));
      });
    });
  }

  setInitialMode() {
    const params = new URLSearchParams(window.location.search);
    this.setMode(params.get("mode") || "login", { syncUrl: false });
  }

  setMode(mode, options = {}) {
    const { syncUrl = true } = options;
    this.mode = mode === "register" ? "register" : "login";

    queryAll("[data-auth-mode]").forEach((button) => {
      button.classList.toggle("auth-tabs__button--active", button.dataset.authMode === this.mode);
    });

    if (syncUrl) {
      this.syncModeInUrl();
    }

    this.configureInputsForMode();
    this.renderModeHint();
    this.renderRedirectHint();
    this.clearFeedback();
    this.clearFieldErrors();
  }

  configureInputsForMode() {
    const isRegisterMode = this.mode === "register";

    if (this.submitButton) {
      this.submitButton.textContent = isRegisterMode ? "Создать аккаунт" : "Войти";
    }

    if (this.passwordInput) {
      this.passwordInput.autocomplete = isRegisterMode ? "new-password" : "current-password";
    }

    if (this.confirmGroup && this.confirmInput) {
      this.confirmGroup.hidden = !isRegisterMode;
      this.confirmInput.disabled = !isRegisterMode;
      this.confirmInput.required = isRegisterMode;
      this.confirmInput.setCustomValidity("");
      this.confirmInput.setAttribute("aria-invalid", "false");

      if (!isRegisterMode) {
        this.confirmInput.value = "";
      }
    }
  }

  renderModeHint() {
    if (!this.hintNode) {
      return;
    }

    this.hintNode.textContent =
      this.mode === "register"
        ? "После регистрации мы автоматически попробуем выполнить вход и сразу перевести вас дальше."
        : "Используйте email и пароль, которые уже зарегистрированы в системе.";
  }

  renderRedirectHint() {
    if (!this.redirectNode) {
      return;
    }

    this.redirectNode.textContent =
      this.mode === "register"
        ? `После создания аккаунта вернем вас ${this.redirectMeta.destinationText}.`
        : `После входа вернем вас ${this.redirectMeta.destinationText}.`;
  }

  syncModeInUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", this.mode);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async handleSubmit() {
    if (!this.form) {
      return;
    }

    this.emailInput.value = this.normalizeEmail(this.emailInput.value);

    if (!this.validateForm({ report: true })) {
      this.setFeedback("Проверьте форму: заполните обязательные поля и исправьте ошибки.", "error");
      this.setStatus("Форма содержит ошибки валидации.");
      return;
    }

    const payload = {
      email: this.normalizeEmail(this.emailInput.value),
      password: this.passwordInput.value
    };

    this.setSubmitting(true);
    this.clearFeedback();

    try {
      if (this.mode === "register") {
        await this.handleRegister(payload);
      } else {
        await this.handleLogin(payload);
      }
    } catch (error) {
      console.error(error);
      this.setFeedback(this.getAuthErrorMessage(error), "error");
      this.setStatus("Не удалось выполнить авторизацию.");
    } finally {
      this.setSubmitting(false);
    }
  }

  async handleLogin(payload) {
    await authService.login(payload);
    this.setFeedback(`Вход выполнен успешно. Перенаправляем вас ${this.redirectMeta.destinationText}.`, "success");
    this.setStatus("Пользователь авторизован.");
    showToast("Вход выполнен успешно");
    this.redirectAfterAuth();
  }

  async handleRegister(payload) {
    await authService.register(payload);

    try {
      await authService.login(payload);
      this.setFeedback(
        `Аккаунт создан, вход выполнен автоматически. Перенаправляем вас ${this.redirectMeta.destinationText}.`,
        "success"
      );
      this.setStatus("Аккаунт создан, пользователь авторизован.");
      showToast("Аккаунт создан");
      this.redirectAfterAuth();
      return;
    } catch (loginError) {
      console.error(loginError);
      this.setMode("login");
      this.setFeedback("Аккаунт создан. Теперь войдите с тем же email и паролем.", "success");
      this.setStatus("Аккаунт создан. Ожидается вход пользователя.");
      showToast("Аккаунт создан, теперь войдите");
    }
  }

  setSubmitting(isSubmitting) {
    const loadingLabel = this.mode === "register" ? "Создаем аккаунт..." : "Выполняем вход...";

    if (this.emailInput) {
      this.emailInput.disabled = isSubmitting;
    }

    if (this.passwordInput) {
      this.passwordInput.disabled = isSubmitting;
    }

    if (this.confirmInput) {
      this.confirmInput.disabled = isSubmitting || this.mode !== "register";
    }

    queryAll("[data-auth-mode], [data-password-toggle]").forEach((button) => {
      button.disabled = isSubmitting;
    });

    if (this.submitButton) {
      this.submitButton.disabled = isSubmitting;
      this.submitButton.textContent = isSubmitting
        ? loadingLabel
        : this.mode === "register"
          ? "Создать аккаунт"
          : "Войти";
    }
  }

  validateForm(options = {}) {
    const { report = false } = options;
    const inputs = [this.emailInput, this.passwordInput];

    if (this.mode === "register") {
      inputs.push(this.confirmInput);
    }

    let isValid = true;

    inputs
      .filter(Boolean)
      .forEach((input) => {
        const fieldIsValid = this.validateField(input, { report });
        if (!fieldIsValid) {
          isValid = false;
        }
      });

    return isValid;
  }

  validateField(input, options = {}) {
    const { report = false } = options;
    if (!input || input.disabled) {
      return true;
    }

    const key = this.getFieldKey(input);
    const message = this.getFieldErrorMessage(input);
    input.setCustomValidity(message);
    input.setAttribute("aria-invalid", String(Boolean(message)));
    this.setFieldError(key, message);

    if (report && message) {
      input.reportValidity();
    }

    return !message;
  }

  getFieldErrorMessage(input) {
    if (input === this.emailInput) {
      if (!input.value.trim()) {
        return "Введите email.";
      }

      if (!input.validity.valid) {
        return "Введите корректный email.";
      }
    }

    if (input === this.passwordInput) {
      if (!input.value) {
        return "Введите пароль.";
      }

      if (input.value.length < 8) {
        return "Пароль должен содержать минимум 8 символов.";
      }
    }

    if (input === this.confirmInput && this.mode === "register") {
      if (!input.value) {
        return "Повторите пароль.";
      }

      if (input.value !== this.passwordInput.value) {
        return "Пароли не совпадают.";
      }
    }

    return "";
  }

  getFieldKey(input) {
    if (input === this.emailInput) {
      return "email";
    }

    if (input === this.passwordInput) {
      return "password";
    }

    return "confirm";
  }

  setFieldError(key, message) {
    const node = this.fieldErrors.get(key);
    if (!node) {
      return;
    }

    node.textContent = message || "";
  }

  clearFieldErrors() {
    this.fieldErrors.forEach((node) => {
      node.textContent = "";
    });

    [this.emailInput, this.passwordInput, this.confirmInput]
      .filter(Boolean)
      .forEach((input) => {
        input.setCustomValidity("");
        input.setAttribute("aria-invalid", "false");
      });
  }

  setFeedback(message, tone = "neutral") {
    if (!this.feedbackNode) {
      return;
    }

    this.feedbackNode.hidden = false;
    this.feedbackNode.textContent = message;
    this.feedbackNode.className = `auth-form__feedback auth-form__feedback--${tone}`;
  }

  clearFeedback() {
    if (!this.feedbackNode) {
      return;
    }

    this.feedbackNode.hidden = true;
    this.feedbackNode.textContent = "";
    this.feedbackNode.className = "auth-form__feedback";
  }

  resolveRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");

    if (!redirect || redirect.includes("://") || redirect.startsWith("//")) {
      return {
        target: "./catalog.html",
        destinationText: "в каталог"
      };
    }

    const normalized = redirect.replace(/^\/+/, "");
    const target = normalized.startsWith(".") ? normalized : `./${normalized}`;
    const pageKey = target.replace(/^\.\//, "").split("?")[0];

    return {
      target,
      destinationText: REDIRECT_LABELS[pageKey] || "на нужную страницу"
    };
  }

  normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  getAuthErrorMessage(error) {
    const rawMessage = String(error?.message || "").toLowerCase();

    if (rawMessage.includes("invalid credentials")) {
      return "Неверный email или пароль. Проверьте данные и попробуйте еще раз.";
    }

    if (rawMessage.includes("email already exists")) {
      return "Аккаунт с таким email уже существует. Попробуйте войти или используйте другой email.";
    }

    if (error?.status === 400) {
      return "Проверьте корректность email и пароля.";
    }

    if (error?.status >= 500) {
      return "Сервер временно недоступен. Попробуйте чуть позже.";
    }

    return error?.message || "Не удалось выполнить запрос. Попробуйте позже.";
  }

  redirectAfterAuth() {
    window.setTimeout(() => {
      window.location.replace(this.redirectMeta.target);
    }, 450);
  }
}

new AuthPage().init();
