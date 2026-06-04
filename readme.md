# CONTEXT FOR AI DEVELOPER: Subscription & Regular Payments Manager

## 🎯 Project Overview

We are developing a lightweight, high-performance web panel for tracking subscriptions and regular payments (Netflix, AWS, Mobile, etc.) from scratch.
The project emphasizes advanced date arithmetic, raw SQL aggregations, and ultra-low memory consumption.

## 💾 Infrastructure Hard Restrictions (Crucial!)

- **Target Server:** Cheap Linux VPS with only **1 CPU Core** and **800 MB RAM**.
- **Memory Strategy:** Every megabyte counts. No heavy frameworks, no bloated libraries.
- **NO Celery / NO Redis / NO RabbitMQ:** Background tasks must run via native Linux Cron or lightweight in-app asyncio loops.
- **Networking:** Port 443 is BUSY. The application will serve traffic on a custom port with SSL (e.g., **8443**) via Nginx reverse proxy.
- **Telegram Bot:** Strictly **Long Polling** mode. Webhooks are forbidden to save RAM and avoid extra open ports.

## 🛠️ Technology Stack

1. **Backend:** Python 3.11+ / FastAPI + Uvicorn + SQLAlchemy (Strictly **Async** mode via `asyncpg`).
2. **Database:** PostgreSQL (Must be tuned for low RAM).
3. **Frontend:** Lightweight SPA written in **Vanilla HTML / CSS / JS** (Single-page app).
4. **Static Delivery:** FastAPI will serve frontend static files directly (`StaticFiles`) to eliminate the need for a separate Node.js/Next.js server and save ~150-200MB RAM.

## 📊 Database Schema (PostgreSQL)

### 1. `users`

- `id` (SERIAL / BIGSERIAL, PK)
- `email` (VARCHAR(255), Unique)
- `telegram_id` (BIGINT, Nullable, Unique)
- `currency` (VARCHAR(3), Default 'USD')

### 2. `categories`

- `id` (SERIAL, PK)
- `user_id` (INT, FK -> users.id, Nullable - NULL means system default category)
- `name` (VARCHAR(100))

### 3. `subscriptions`

- `id` (SERIAL, PK)
- `user_id` (INT, FK -> users.id, On Delete Cascade)
- `category_id` (INT, FK -> categories.id, On Delete Set Null)
- `title` (VARCHAR(255))
- `amount` (NUMERIC(10, 2))
- `currency` (VARCHAR(3))
- `billing_period` (VARCHAR(10) - Strictly check constraints: 'month' or 'year')
- `next_payment_date` (DATE)
- `is_active` (BOOLEAN, Default True)

### 4. `payment_history`

- `id` (BIGSERIAL, PK)
- `subscription_id` (INT, FK -> subscriptions.id, On Delete Cascade)
- `payment_date` (DATE)
- `amount_paid` (NUMERIC(10, 2))

## ⚡ Key Features & Business Logic Rules

1. **Date Shift Logic:** When a user marks a subscription as "paid", the system logs the transaction into `payment_history` and shifts `next_payment_date` forward using PostgreSQL `INTERVAL '1 month'` or `INTERVAL '1 year'`.
2. **SQL-Driven Analytics (No Pandas/Python processing for math):**
   - **Current Month Spend:** Aggregate sums grouped by category for the current calendar month.
   - **Cost Forecast:** Dynamic forecast for the next 30, 90, and 365 days based on active subscriptions and their frequencies.
3. **Automation:** A lightweight, daily-triggered CLI Python script (via Linux Cron) to scan the DB for subscriptions expiring in 24 hours and trigger notifications.

## 🤖 AI Guardrails & Code Style

- Write clean, idiomatic, asynchronous Python code.
- Minimize global states and avoid massive imports that leak memory.
- Prefer raw SQL (`text()`) or performance-optimized SQLAlchemy core expressions for analytical queries.
- Do not generate oversized monolithic code blocks; provide modular, step-by-step solutions.
