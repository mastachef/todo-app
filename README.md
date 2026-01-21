# Todo List App

A beautiful, modern task management PWA with a warm, minimal design. Works offline and syncs across devices when signed in.

## Screenshots

<p align="center">
  <img src="imgs/Screenshot_1.png" alt="Task List View" width="100%">
</p>

<p align="center">
  <em>Organize tasks into custom lists with color-coded priorities</em>
</p>

<p align="center">
  <img src="imgs/Screenshot_2.png" alt="Focus Mode" width="48%">
  <img src="imgs/Screenshot_3.png" alt="Analytics Dashboard" width="48%">
</p>

<p align="center">
  <em>Focus Mode with Pomodoro timer &nbsp;|&nbsp; Analytics dashboard to track productivity</em>
</p>

## Features

### Task Management
- **Multiple lists** - Organize tasks into custom categories (Work, Personal, House, etc.)
- **Priority levels** - Color-coded flags (high/medium/low) to highlight important tasks
- **Task notes** - Add detailed notes and context to any task
- **Sorting options** - Sort by newest, oldest, or priority
- **Bulk actions** - Select multiple tasks to complete, move, or delete at once
- **Search** - Quickly find tasks across all your lists

### Productivity
- **Focus Mode** - Distraction-free view with built-in Pomodoro timer
  - Customizable work/break durations (default 25/5 min)
  - Star tasks to add them to your focus list
- **Reminders** - Set datetime reminders with repeat options (hourly, daily, weekly, monthly)
- **Recurring tasks** - Tasks that automatically recreate when completed
- **Analytics** - Track completion rates, tasks by priority, and weekly/monthly progress

### Cross-Platform
- **Progressive Web App** - Install on iOS, Android, or desktop
- **Offline support** - Full functionality without internet
- **Cloud sync** - Sign in to sync across all devices
- **Dark/Light mode** - System-aware theme with manual toggle

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript, CSS3, HTML5 |
| Backend | Netlify Functions (serverless) |
| Database | PostgreSQL (Neon) |
| Auth | JWT + bcrypt |
| Notifications | Web Push API |
| Hosting | Netlify |

## Getting Started

### Prerequisites
- Node.js 18+
- Netlify CLI

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/todo-app.git
cd todo-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start development server
npm run dev
```

Open [http://localhost:8888](http://localhost:8888)

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-secret-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

### Deployment

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

## Project Structure

```
todo-app/
├── index.html          # Main app
├── app.js              # Core application logic
├── styles.css          # Styles (light/dark themes)
├── sw.js               # Service worker for offline
├── manifest.json       # PWA manifest
├── analytics.html/js   # Analytics dashboard
├── imgs/               # Screenshots
└── netlify/functions/  # Serverless API
    ├── api-tasks.js
    ├── api-lists.js
    ├── auth-*.js
    └── db.js
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Sign in |
| `GET` | `/auth/me` | Get current user |
| `GET` | `/api/tasks` | List tasks |
| `POST` | `/api/tasks` | Create task |
| `PUT` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `GET` | `/api/lists` | List all lists |
| `POST` | `/api/lists` | Create list |
| `PUT` | `/api/lists/:id` | Update list |
| `DELETE` | `/api/lists/:id` | Delete list |

## Offline Mode

The app works fully offline:
- Tasks stored in localStorage
- Service worker caches all assets
- Use "Continue without account" for offline-only mode
- Syncs automatically when connection restores

## License

MIT
