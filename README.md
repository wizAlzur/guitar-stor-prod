# Six Strings Store

Курсовой проект интернет-магазина гитар: Go API + frontend на `Vite`, `vanilla JavaScript` и `BEM`.

## Что уже реализовано

- каталог товаров с загрузкой из API и поиском;
- регистрация и вход по JWT;
- корзина на Redis;
- создание заказов и история заказов;
- интеграция оплаты через YooKassa;
- страницы результата оплаты;
- адаптивный frontend;
- автодеплой frontend на `GitHub Pages` через GitHub Actions.

## Стек

- Backend: `Go`, `gin`, `pgx`, `PostgreSQL`, `Redis`
- Frontend: `Vite`, `vanilla JavaScript`, `HTML`, `CSS`, `BEM`
- Infra: `Docker Compose`, `GitHub Pages`, `GitHub Actions`

## Структура проекта

- [cmd/api](./cmd/api) — точка входа backend
- [internal](./internal) — handlers, services, repositories, config
- [migrations](./migrations) — SQL-миграции
- [frontend](./frontend) — клиентская часть
- [docs/frontend-ux-spec.md](./docs/frontend-ux-spec.md) — зафиксированная UX-структура frontend

## Локальный запуск

### 1. Поднять backend-стек

Из корня проекта:

```bash
docker compose up -d --build
```

После запуска будут доступны:

- API: `http://localhost:8080`
- healthcheck: `http://localhost:8080/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Миграции применяются автоматически при первом старте контейнера `postgres`.

### 2. Запустить frontend в dev-режиме

Из папки `frontend`:

```bash
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:5173`.

### 3. Переменные окружения для локальной разработки

Backend использует:

- [.env](./.env) — для запуска на хосте
- `.env.docker` — для запуска в контейнерах

Frontend использует:

- [frontend/.env.example](./frontend/.env.example)

Базовые локальные значения уже рассчитаны на:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8080`

## Production-сборка frontend

Из папки `frontend`:

```bash
npm run build
```

Production-шаблон переменных:

- [frontend/.env.production.example](./frontend/.env.production.example)

Сейчас production-сборка по умолчанию использует относительный `base` (`./`), поэтому подходит для публикации на `GitHub Pages`.

## Публикация frontend на GitHub Pages

Workflow уже добавлен:

- [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml)

### Что нужно сделать в GitHub

1. Открыть `Settings -> Pages`.
2. Убедиться, что source для Pages использует `GitHub Actions`.
3. Открыть `Settings -> Secrets and variables -> Actions -> Variables`.
4. Добавить repository variable:

`VITE_API_BASE_URL=https://your-backend.example.com`

После этого достаточно пуша в ветку `main`: workflow соберёт `frontend/dist` и опубликует его на `GitHub Pages`.

## Что нужно для production-backend

`GitHub Pages` публикует только статический frontend. Чтобы сайт работал не как макет, а как готовый продукт, backend должен быть доступен по публичному HTTPS-адресу.

Для production-backend нужно проверить как минимум такие переменные:

- `FRONTEND_URL=https://<username>.github.io/<repo>` или ваш custom domain
- `FRONTEND_PAYMENT_SUCCESS_PATH=/payment-success.html`
- `FRONTEND_PAYMENT_FAIL_PATH=/payment-fail.html`
- `YOOKASSA_SUCCESS_URL=https://your-backend.example.com/success`
- `YOOKASSA_FAIL_URL=https://your-backend.example.com/fail`
- `YOOKASSA_WEBHOOK_URL=https://your-backend.example.com/webhook/yookassa`
- `DATABASE_URL=...`
- `REDIS_URL=...`
- `JWT_SECRET=...`
- `ADMIN_API_KEY=...`

Важно:

- `FRONTEND_URL` должен совпадать с реальным адресом опубликованного frontend, иначе CORS и редиректы после оплаты будут работать неправильно.
- `VITE_API_BASE_URL` должен указывать на тот же публичный backend, который обслуживает заказы и оплату.

## Проверка перед защитой

Минимальный чек-лист:

1. Открывается опубликованный frontend.
2. Каталог загружает товары с production API.
3. Регистрация и вход работают.
4. Корзина сохраняет товары.
5. Заказ создаётся.
6. После возврата с оплаты открываются `payment-success.html` или `payment-fail.html`.
7. История заказов показывает актуальный статус.

## Полезные команды

Backend:

```bash
docker compose up -d --build
docker compose ps
docker compose logs api --tail=100
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
```
