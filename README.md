#  Shabiki Aviator Platform

> A real-time multiplayer Aviator crash game platform with M-Pesa & PayPal integration, built with Django REST Framework + React.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [M-Pesa Integration](#m-pesa-integration)
- [PayPal Integration](#paypal-integration)
- [Dev Mode (Bypass Payments)](#dev-mode-bypass-payments)
- [Admin Panel](#admin-panel)
- [Game Logic](#game-logic)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Deployment](#deployment)

---

## Overview

**Shabiki** is a full-stack Aviator crash gambling game platform. Players deposit funds via M-Pesa or PayPal, place bets before a plane takes off, and must cash out before the plane crashes. The multiplier grows in real-time — the longer you wait, the higher the reward, but if you don't cash out in time, you lose your bet.

### Key Features

- 🎮 Real-time Aviator game via WebSockets (Django Channels)
- 💰 M-Pesa STK Push deposits & withdrawals
- 💳 PayPal withdraw support
- 🛡️ Dev mode to bypass payment for testing
- 🔐 JWT authentication
- 👑 Full admin dashboard (game control, user management, manual payouts)
- 📊 Transaction history & bet history
- 🚀 Auto cash-out feature
- 📱 Fully responsive React frontend

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        FRONTEND                          │
│              React + Vite + Bootstrap 5                  │
│   Pages: Home, Game, Wallet, History, Admin              │
└───────────────────┬─────────────────────────────────────┘
                    │ REST API + WebSocket
┌───────────────────▼─────────────────────────────────────┐
│                        BACKEND                           │
│           Django REST Framework + Channels               │
│   Apps: users, game, wallet, transactions, admin_panel   │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   PostgreSQL    Redis      Celery
   (Database)  (Cache/WS)  (Async Tasks)
        │                       │
        └───────────┬───────────┘
                    ▼
          M-Pesa Daraja API
          PayPal REST API
```

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Django 4.2 | Core web framework |
| Django REST Framework | REST API |
| Django Channels | WebSocket / real-time game |
| Celery + Redis | Background tasks (game loop, STK push polling) |
| PostgreSQL | Primary database |
| Simple JWT | Authentication |
| django-cors-headers | CORS handling |
| requests | M-Pesa & PayPal HTTP calls |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework |
| React Router v6 | Client-side routing |
| Bootstrap 5 | UI components & grid |
| Axios | HTTP client |
| Motion (Framer Motion) | Plane animation & transitions |
| React Query | Server state management |
| React Toastify | Flash messages |
| Recharts | Charts in admin/history |

---

## Project Structure

```
shabiki/
├── backend/
│   ├── shabiki/                  # Django project root
│   │   ├── __init__.py
│   │   ├── settings.py           # All settings (dev/prod)
│   │   ├── urls.py               # Main URL config
│   │   ├── asgi.py               # ASGI + Channels config
│   │   └── wsgi.py
│   ├── users/                    # Auth & user profiles
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── game/                     # Aviator game logic
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── consumers.py          # WebSocket consumer
│   │   ├── tasks.py              # Celery game loop
│   │   └── urls.py
│   ├── wallet/                   # Balance, deposits, withdrawals
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── transactions/             # Transaction records
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── admin_panel/              # Custom admin controls
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── index.html                # HTML shell + Bootstrap + plane CSS
│   ├── src/
│   │   ├── main.jsx              # React entry point
│   │   ├── App.jsx               # Router + auth guards
│   │   ├── utils/
│   │   │   └── api.js            # Axios instance + interceptors
│   │   ├── components/
│   │   │   ├── FlashMessages.jsx # Toast notification wrapper
│   │   │   ├── Navbar.jsx
│   │   │   ├── PlaneAnimation.jsx
│   │   │   ├── BetPanel.jsx
│   │   │   ├── MultiplierDisplay.jsx
│   │   │   ├── PlayersList.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── GamePage.jsx
│   │   │   ├── WalletPage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   └── pages/admin/
│   │       ├── AdminDashboard.jsx
│   │       ├── AdminUsers.jsx
│   │       ├── AdminGames.jsx
│   │       ├── AdminTransactions.jsx
│   │       └── AdminSettings.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Backend Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Redis 7+
- Node.js 18+ (for frontend)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourorg/shabiki.git
cd shabiki/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your values

# Run migrations
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser

# Start Redis (required for Channels + Celery)
redis-server

# Start Celery worker (in a separate terminal)
celery -A shabiki worker -l info

# Start Celery beat (game scheduler)
celery -A shabiki beat -l info

# Run development server
python manage.py runserver
```

---

## Frontend Setup

```bash
cd shabiki/frontend

# Install dependencies
npm install

# Copy env
cp .env.example .env.local
# Set VITE_API_URL and VITE_WS_URL

# Start development server
npm run dev

# Build for production
npm run build
```

---

## Environment Variables

### Backend `.env`

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shabiki

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# M-Pesa Daraja (Safaricom)
MPESA_ENVIRONMENT=sandbox           # or 'production'
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379              # Sandbox shortcode
MPESA_PASSKEY=your_lipa_na_mpesa_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/wallet/mpesa/callback/

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox          # or 'live'

# Dev Mode (bypass real payments)
DEV_MODE=True
DEV_AUTO_APPROVE_DEPOSITS=True

# Game Settings
GAME_MIN_BET=10                     # KES
GAME_MAX_BET=50000                  # KES
GAME_MIN_CASHOUT=1.01
GAME_HOUSE_EDGE=0.05                # 5%
```

### Frontend `.env.local`

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
VITE_DEV_MODE=true
```

---

## M-Pesa Integration

Shabiki uses the **Safaricom Daraja API** for:

### Deposits (STK Push)
1. User enters phone number + amount on the Wallet page
2. Backend calls `POST /mpesa/stkpush/` → Safaricom sends a push notification to user's phone
3. User enters M-Pesa PIN on their phone
4. Safaricom sends result to `MPESA_CALLBACK_URL`
5. Backend processes callback → credits user wallet
6. Frontend polls `/wallet/deposit/status/{id}/` and shows success/fail

### Withdrawals (B2C)
1. User requests withdrawal → backend initiates B2C transfer
2. Safaricom processes and sends funds to user's phone
3. Callback updates transaction status

### Sandbox Testing
Use Safaricom sandbox phone: `254708374149` with any amount.
Use PIN: `1234` when prompted.

---

## PayPal Integration

### Withdrawals Only
1. User submits PayPal email + amount
2. Backend calls PayPal Payouts API
3. PayPal transfers funds to user's email
4. Transaction logged and wallet debited

---

## Dev Mode (Bypass Payments)

Set `DEV_MODE=True` in `.env`. In dev mode:

- **Deposit**: Click "Dev Deposit" button → wallet credited instantly (no STK push)
- **Withdraw**: Instantly approved, no real transfer made
- A `[DEV]` badge appears in the UI to remind you
- All game rounds still run normally

---

## Admin Panel

Access at `/admin-panel` in the frontend (requires `is_staff=True`).

### Admin Capabilities
| Feature | Description |
|---|---|
| **Dashboard** | Live stats: active users, bets, revenue, house P&L |
| **User Management** | View/ban/unban users, adjust balances manually |
| **Game Control** | Force-stop a round, set crash multiplier manually, pause game |
| **Transactions** | View all deposits/withdrawals, approve/reject pending |
| **Settings** | Set min/max bet, house edge, max multiplier cap |
| **Reports** | Download CSV of transactions, game history |

Django's built-in `/admin/` is also available for superusers.

---

## Game Logic

### How Aviator Works

1. **Betting Phase** (5 seconds): Players place bets
2. **Takeoff**: Plane takes off, multiplier starts at 1.00x
3. **Multiplier grows** exponentially in real time
4. **Players cash out** anytime to lock in their multiplier
5. **Crash**: Game randomly crashes at a provably-fair multiplier
6. Players who didn't cash out **lose their bet**
7. New round starts after a 5-second cooldown

### Crash Point Algorithm

```python
# Provably fair crash point generation
import hmac, hashlib

def generate_crash_point(seed, house_edge=0.05):
    h = hmac.new(seed.encode(), digestmod=hashlib.sha256).hexdigest()
    n = int(h[:8], 16)
    result = max(1.0, (100 / (1 - (n / 0xFFFFFFFF))) * (1 - house_edge))
    return round(result, 2)
```

### WebSocket Events

| Event | Direction | Payload |
|---|---|---|
| `game.state` | Server→Client | `{status, multiplier, round_id}` |
| `bet.place` | Client→Server | `{amount, auto_cashout?}` |
| `bet.cashout` | Client→Server | `{round_id}` |
| `bet.result` | Server→Client | `{won, multiplier, payout}` |
| `game.crash` | Server→Client | `{crash_point, round_id}` |
| `players.update` | Server→Client | `[{username, bet, status}]` |

---

## API Endpoints

### Auth
```
POST   /api/auth/register/
POST   /api/auth/login/
POST   /api/auth/refresh/
POST   /api/auth/logout/
GET    /api/auth/me/
```

### Wallet
```
GET    /api/wallet/balance/
POST   /api/wallet/deposit/mpesa/
POST   /api/wallet/deposit/dev/          # Dev mode only
GET    /api/wallet/deposit/status/{id}/
POST   /api/wallet/withdraw/mpesa/
POST   /api/wallet/withdraw/paypal/
```

### Game
```
GET    /api/game/rounds/
GET    /api/game/rounds/{id}/
GET    /api/game/my-bets/
GET    /api/game/leaderboard/
```

### Transactions
```
GET    /api/transactions/
GET    /api/transactions/{id}/
```

### Admin
```
GET    /api/admin-panel/stats/
GET    /api/admin-panel/users/
PATCH  /api/admin-panel/users/{id}/
GET    /api/admin-panel/transactions/
PATCH  /api/admin-panel/transactions/{id}/
GET    /api/admin-panel/games/
POST   /api/admin-panel/games/control/
GET    /api/admin-panel/settings/
PATCH  /api/admin-panel/settings/
```

---

## Deployment

### Docker (Recommended)

```bash
docker-compose up --build
```

### Manual Production

```bash
# Backend
gunicorn shabiki.asgi:application -k uvicorn.workers.UvicornWorker

# Frontend
npm run build
# Serve /dist with Nginx

# Celery
celery -A shabiki worker --detach
celery -A shabiki beat --detach
```

### Nginx Config (snippet)

```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

location /api/ {
    proxy_pass http://127.0.0.1:8000;
}

location / {
    root /var/www/shabiki/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## Requirements

```
# backend/requirements.txt
Django==4.2.9
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.1
django-cors-headers==4.3.1
channels==4.0.0
channels-redis==4.2.0
celery==5.3.6
redis==5.0.1
psycopg2-binary==2.9.9
python-decouple==3.8
requests==2.31.0
daphne==4.0.0
```

---

## Security Notes

- All game rounds use server-side RNG — clients cannot predict or influence crash points
- JWT tokens expire; use refresh tokens for session persistence
- M-Pesa callbacks are verified by checking the `ResultCode` and matching `CheckoutRequestID`
- Admin endpoints require `is_staff=True` — never expose to regular users
- Rate limiting on bet endpoints prevents abuse
- In production, set `DEV_MODE=False` and `DEBUG=False`

---

## License

MIT © 2024 Shabiki Platform

---

> Built with Tech001 for the Kenyan gaming community. Play responsibly.