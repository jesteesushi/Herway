# HerWay

Community-reported street and public transit safety map for women and girls in Bangladesh.

---

## 🚀 Quick Start

### 1. Installation

```bash
npm install --legacy-peer-deps
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anonymous / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret key (for backend scripts & CLI bootstrap) |
| `VITE_MAPTILER_API_KEY` | Production geocoding & Dataviz basemap key from [MapTiler](https://cloud.maptiler.com/) |
| `MODERATOR_BOOTSTRAP_TOKEN` | Secure token (min 8 chars) required to claim the first moderator role |

### 3. Database Setup

Apply the SQL migrations in `supabase/migrations/` in sequential order:
1. `0000_herway_phase1.sql`: Core tables, RLS policies, rate limiting, and incident schema.
2. `0001_herway_community.sql`: Community rooms, post threads, blocking, and abuse flags.
3. `0002_herway_moderation_security.sql`: Server-side report approval with server location rounding, atomic actions, and moderator bootstrapping.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🛡️ Security & Privacy Architecture

- **Public / Private Data Boundary:**
  - Precise incident coordinates, timestamps, raw reporter details, and descriptions live strictly in private tables (`incident_reports`).
  - The public map queries only `published_incidents`.
- **Server-Side Location Rounding & Single-Step Approval:**
  - When a report is approved, `public.approve_and_publish_report` runs entirely on the server inside a single atomic database transaction.
  - The server snaps coordinates to a ~450 m grid with random bounded jitter directly from private coordinates. Moderators cannot submit unrounded coordinates.
  - Publishing, report status updating, and append-only moderation logging are atomic: they either all succeed or all roll back together.
- **Production Geocoding:**
  - Map search uses MapTiler Geocoding API (`country=bd`, proximity-biased to Bangladesh) for production traffic.
  - Autocomplete search gracefully falls back to Photon search without hitting public OpenStreetMap Nominatim rate limits.

---

## 👥 Creating Moderators (Safe Bootstrapping)

HerWay enforces role-based access control via database RLS (`public.is_moderator()`).

### Option A: Web Bootstrap Portal (First Moderator Only)
1. Sign up / log in to your account.
2. Set `MODERATOR_BOOTSTRAP_TOKEN=your-token-here` in `.env`.
3. Navigate to `/moderation`.
4. When zero moderators exist, the **First-Time Setup** card will prompt for your bootstrap token.
5. Enter the token. Your account will immediately be granted `admin` and `moderator` roles.
6. Once the first moderator is created, the portal is **permanently closed and disabled**.

### Option B: CLI Administrative Script
Run the CLI script using your service-role key:

```bash
# By email address:
npm run bootstrap-moderator user@example.com

# Or by Supabase user UUID:
npm run bootstrap-moderator 550e8400-e29b-41d4-a716-446655440000
```

### Subsequent Moderators
Existing administrators can assign roles to other users directly via the `assign_user_role` database function or from within the moderation management panel.

---

## 🧪 Testing & Build

```bash
# Run unit & component tests
npm test

# Build for production
npm run build

# Preview production build locally
npm run preview
```
