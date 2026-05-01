# ✈️ Shabiki Aviator Platform

> Real-time multiplayer Aviator crash game with M-Pesa & PayPal integration — built for the Kenyan gaming community.

---

## 🚀 Quick Start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in your values
python manage.py migrate
python manage.py createsuperuser
redis-server &                # needs Redis running
celery -A shabiki worker -l info &
celery -A shabiki beat -l info &
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local    # set VITE_API_URL / VITE_WS_URL
npm run dev
```

### Dev game runner (no Redis / Celery needed)
```bash
python manage.py rungame
```

---

## 🏗️ Architecture

```
React (Vite) ──REST/WS──► Django + Channels ──► PostgreSQL
                                  │
                           Redis (WS layer)
                                  │
                    Celery (game loop / task queue)
                                  │
                    M-Pesa Daraja ─── PayPal REST
```

---

## 📁 Project Structure

```
shabiki/
├── backend/
│   ├── shabiki/          # Django project (settings, urls, asgi)
│   ├── core/             # Single app — ALL models, views, serializers
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── consumers.py  # WebSocket game consumer
│   │   ├── tasks.py      # Celery game-loop tasks
│   │   ├── game_engine.py
│   │   ├── mpesa.py
│   │   ├── paypal.py
│   │   ├── urls.py
│   │   └── admin.py
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    ├── index.html        # Bootstrap 5 + GSAP/Motion CDN
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── utils/api.js
        ├── components/
        │   ├── FlashMessages.jsx
        │   ├── Navbar.jsx
        │   ├── PlaneAnimation.jsx
        │   ├── BetPanel.jsx
        │   ├── MultiplierDisplay.jsx
        │   ├── PlayersList.jsx
        │   └── LiveChat.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── GamePage.jsx
            ├── WalletPage.jsx
            ├── HistoryPage.jsx
            ├── ProfilePage.jsx
            └── admin/
                ├── AdminDashboard.jsx
                ├── AdminUsers.jsx
                ├── AdminGames.jsx
                ├── AdminTransactions.jsx
                └── AdminSettings.jsx
```

---

## ⚙️ Environment Variables

### `backend/.env`
```env
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:pass@localhost:5432/shabiki
REDIS_URL=redis://localhost:6379/0

# M-Pesa
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=xxx
MPESA_CONSUMER_SECRET=xxx
MPESA_SHORTCODE=174379
MPESA_PASSKEY=xxx
MPESA_CALLBACK_URL=https://yourdomain.com/api/wallet/mpesa/callback/

# PayPal
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_ENVIRONMENT=sandbox

# Dev
DEV_MODE=True
DEV_AUTO_APPROVE_DEPOSITS=True

# Game
GAME_MIN_BET=10
GAME_MAX_BET=50000
GAME_HOUSE_EDGE=0.05
```

### `frontend/.env.local`
```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
VITE_DEV_MODE=true
```

---

## 🎮 Game Flow

1. **Betting phase** (5s) — players place bets
2. **Takeoff** — plane launches, multiplier starts at 1.00×
3. **In-flight** — multiplier grows at variable speed (randomised per round)
4. **Cash out** — player locks in current multiplier
5. **Crash** — provably-fair RNG determines crash point
6. Players who didn't cash out lose their bet
7. 5-second cooldown → new round

### Crash algorithm (provably fair)
```python
import hmac, hashlib, os

def generate_crash_point(house_edge=0.05):
    seed = os.urandom(32).hex()
    h = hmac.new(seed.encode(), digestmod=hashlib.sha256).hexdigest()
    n = int(h[:8], 16)
    result = max(1.0, (100 / (1 - (n / 0xFFFFFFFF))) * (1 - house_edge))
    return round(result, 2), seed
```

---

## 💳 Payments

| Method | Deposit | Withdraw |
|--------|---------|---------|
| M-Pesa (STK Push) | ✅ | ✅ (B2C) |
| PayPal | ❌ | ✅ (Payouts API) |
| Dev bypass | ✅ instant | ✅ instant |

---

## 👑 Admin Panel

Route: `/admin-panel` (requires `is_staff=True`)

- Live dashboard (revenue, active users, P&L)
- User management (ban/unban, balance adjustment)
- Game control (force crash, pause, manual multiplier cap)
- Transaction approvals
- Settings (min/max bet, house edge)
- CSV export

---

## 🔐 Security

- Server-side RNG only — clients cannot influence crash points
- JWT access (60 min) + refresh (7 days)
- M-Pesa callbacks verified via `CheckoutRequestID` matching
- Admin endpoints guard with `is_staff` permission
- Rate limiting on bet/deposit endpoints
- `DEV_MODE=False` + `DEBUG=False` in production

---

## 🐳 Docker
```bash
docker-compose up --build
```

---

## 📜 License
MIT © 2024 Shabiki Platform — Built for the Kenyan gaming community. **Play responsibly.**