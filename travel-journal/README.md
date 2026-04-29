# 🌍 Wanderlust — Travel Journal

A professional full-stack travel journal web application built with **Node.js / Express** and **Supabase**.

---

## 📁 Project Structure

```
travel-journal/
├── server.js               # Express app entry point
├── package.json
├── .env.example            # Copy to .env and fill in credentials
│
├── config/
│   ├── supabase.js         # Supabase client singleton
│   └── schema.sql          # Database schema — run in Supabase SQL editor
│
├── routes/
│   ├── journals.js         # CRUD for journals
│   ├── entries.js          # CRUD for entries + stats
│   └── profiles.js         # User profiles + session
│
└── public/                 # Static frontend (served by Express)
    ├── index.html
    ├── css/
    │   └── main.css
    └── js/
        ├── api.js          # REST API client module
        └── app.js          # SPA controller
```

---

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste the contents of `config/schema.sql` → Run
3. In **Project Settings → API**, copy your:
   - **Project URL**
   - **Anon / public key**

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SESSION_SECRET=some_long_random_string
PORT=3000
```

### 4. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Visit **http://localhost:3000** 🎉

---

## 🗃️ Database Schema

| Table         | Description                              |
|---------------|------------------------------------------|
| `profiles`    | User accounts (username, email, bio)     |
| `journals`    | Collections of entries                   |
| `entries`     | Individual travel journal entries        |
| `photos`      | Photos attached to entries               |
| `tags`        | Tag vocabulary                           |
| `entry_tags`  | Many-to-many entry ↔ tag relationship    |

---

## 🔌 API Endpoints

### Journals
| Method | Path                | Description          |
|--------|---------------------|----------------------|
| GET    | `/api/journals`     | List all journals    |
| GET    | `/api/journals/:id` | Get journal + entries|
| POST   | `/api/journals`     | Create journal       |
| PUT    | `/api/journals/:id` | Update journal       |
| DELETE | `/api/journals/:id` | Delete journal       |

### Entries
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | `/api/entries`              | List entries (filterable) |
| GET    | `/api/entries/:id`          | Get single entry          |
| POST   | `/api/entries`              | Create entry              |
| PUT    | `/api/entries/:id`          | Update entry              |
| DELETE | `/api/entries/:id`          | Delete entry              |
| GET    | `/api/entries/stats/summary`| Usage statistics          |

### Profiles
| Method | Path                       | Description         |
|--------|----------------------------|---------------------|
| GET    | `/api/profiles/:id`        | Get profile         |
| POST   | `/api/profiles`            | Create/update profile|
| PUT    | `/api/profiles/:id`        | Update profile      |
| GET    | `/api/profiles/session/me` | Current session     |
| POST   | `/api/profiles/session/logout` | Log out        |

---

## ✨ Features

- 📓 **Multiple journals** — organize trips into collections
- 📝 **Rich entries** — title, content, location, country, mood, weather, date, cover image
- 🏷️ **Tags** — flexible tagging system
- 🔍 **Search & Filter** — by keyword or mood
- 🌍 **World Map** — visual overview of visited countries
- 📊 **Stats** — entries count, countries visited
- 👤 **User sessions** — lightweight sign-in with username + email
- 📱 **Responsive design** — works on mobile and desktop

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Frontend**: Vanilla HTML, CSS, JavaScript (no framework)
- **Fonts**: Playfair Display + DM Sans (Google Fonts)
- **Sessions**: express-session

---

## 🔒 Production Checklist

- [ ] Enable Supabase Row Level Security policies (already in schema)
- [ ] Use `NODE_ENV=production` and a strong `SESSION_SECRET`
- [ ] Switch session store from in-memory to Redis / Supabase
- [ ] Add proper authentication (Supabase Auth is a great option)
- [ ] Use Supabase Storage for photo uploads instead of URLs
- [ ] Add rate limiting (`express-rate-limit`)
- [ ] Set up HTTPS
