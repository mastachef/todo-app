import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import db from './database.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// VAPID keys for web push (generate your own at https://vapidkeys.com/)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKvtHA';

webpush.setVapidDetails('mailto:noreply@todo-app.com', VAPID_PUBLIC, VAPID_PRIVATE);

// Email transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Serve static files (frontend)
app.use(express.static(join(__dirname, '../')));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// ============ AUTH ROUTES ============

app.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  
  try {
    const result = db.prepare(`
      INSERT INTO users (email, password, name, verify_token, verify_expires) 
      VALUES (?, ?, ?, ?, ?)
    `).run(email.toLowerCase(), hashedPassword, name || email.split('@')[0], verifyToken, verifyExpires);
    
    const userId = result.lastInsertRowid;
    
    // Create default list
    db.prepare('INSERT INTO lists (user_id, name) VALUES (?, ?)').run(userId, 'My Tasks');
    
    // Send verification email
    if (process.env.SMTP_USER) {
      const verifyUrl = `${BASE_URL}/auth/verify/${verifyToken}`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Verify your Todo App account',
        html: `
          <h2>Welcome to Todo App!</h2>
          <p>Click the link below to verify your email:</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#e07a5f;color:white;text-decoration:none;border-radius:6px;">Verify Email</a>
          <p>Or copy this link: ${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
        `
      });
      res.json({ message: 'Check your email to verify your account' });
    } else {
      // No email configured - auto-verify for development
      db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(userId);
      req.session.userId = userId;
      res.json({ user: { id: userId, email, name: name || email.split('@')[0] } });
    }
  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/auth/verify/:token', (req, res) => {
  const { token } = req.params;
  
  const user = db.prepare(`
    SELECT id FROM users 
    WHERE verify_token = ? AND datetime(verify_expires) > datetime('now') AND verified = 0
  `).get(token);
  
  if (!user) {
    return res.redirect('/?error=invalid-token');
  }
  
  db.prepare('UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?').run(user.id);
  req.session.userId = user.id;
  res.redirect('/?verified=1');
});

app.post('/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  
  const user = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(email?.toLowerCase());
  
  if (!user) {
    return res.json({ message: 'If that email exists, a verification link has been sent' });
  }
  
  if (user.verified) {
    return res.status(400).json({ error: 'Account already verified' });
  }
  
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?')
    .run(verifyToken, verifyExpires, user.id);
  
  if (process.env.SMTP_USER) {
    const verifyUrl = `${BASE_URL}/auth/verify/${verifyToken}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Verify your Todo App account',
      html: `
        <h2>Verify your email</h2>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#e07a5f;color:white;text-decoration:none;border-radius:6px;">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `
    });
  }
  
  res.json({ message: 'If that email exists, a verification link has been sent' });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  if (!user.verified) {
    return res.status(401).json({ error: 'Please verify your email first', needsVerification: true });
  }
  
  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user });
});

// ============ API ROUTES ============

// Lists
app.get('/api/lists', requireAuth, (req, res) => {
  const lists = db.prepare('SELECT * FROM lists WHERE user_id = ? ORDER BY created_at').all(req.session.userId);
  res.json(lists);
});

app.post('/api/lists', requireAuth, (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO lists (user_id, name) VALUES (?, ?)').run(req.session.userId, name);
  res.json({ id: result.lastInsertRowid, name, user_id: req.session.userId });
});

app.put('/api/lists/:id', requireAuth, (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE lists SET name = ? WHERE id = ? AND user_id = ?').run(name, req.params.id, req.session.userId);
  res.json({ success: true });
});

app.delete('/api/lists/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM lists WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ success: true });
});

// Tasks
app.get('/api/tasks', requireAuth, (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { list_id, text, notes, priority, reminder_time, reminder_repeat } = req.body;
  const result = db.prepare(`
    INSERT INTO tasks (list_id, user_id, text, notes, priority, reminder_time, reminder_repeat)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(list_id, req.session.userId, text, notes || '', priority || 'none', reminder_time || null, reminder_repeat || null);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.json(task);
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { text, notes, priority, completed, reminder_time, reminder_repeat } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  const completedAt = completed && !task.completed ? new Date().toISOString() : (completed ? task.completed_at : null);
  
  db.prepare(`
    UPDATE tasks SET text = ?, notes = ?, priority = ?, completed = ?, completed_at = ?, 
    reminder_time = ?, reminder_repeat = ? WHERE id = ? AND user_id = ?
  `).run(
    text ?? task.text,
    notes ?? task.notes,
    priority ?? task.priority,
    completed ? 1 : 0,
    completedAt,
    reminder_time !== undefined ? reminder_time : task.reminder_time,
    reminder_repeat !== undefined ? reminder_repeat : task.reminder_repeat,
    req.params.id,
    req.session.userId
  );
  
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ success: true });
});

// ============ PUSH NOTIFICATIONS ============

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const { subscription } = req.body;
  
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subscription.endpoint);
  db.prepare('INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES (?, ?, ?)').run(
    req.session.userId,
    subscription.endpoint,
    JSON.stringify(subscription.keys)
  );
  
  res.json({ success: true });
});

// Send notification helper
function sendNotification(userId, title, body, data = {}) {
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  
  subscriptions.forEach(sub => {
    const pushSubscription = { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) };
    
    webpush.sendNotification(pushSubscription, JSON.stringify({ title, body, data }))
      .catch(err => {
        if (err.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
      });
  });
}

// Check for reminders every minute
cron.schedule('* * * * *', () => {
  const now = new Date();
  const tasks = db.prepare(`
    SELECT t.*, u.id as uid FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE t.completed = 0 
    AND t.reminder_time IS NOT NULL 
    AND datetime(t.reminder_time) <= datetime(?)
  `).all(now.toISOString());
  
  tasks.forEach(task => {
    sendNotification(task.uid, '⏰ Reminder', task.text, { taskId: task.id });
    
    if (task.reminder_repeat) {
      const date = new Date(task.reminder_time);
      switch (task.reminder_repeat) {
        case 'hourly': date.setHours(date.getHours() + 1); break;
        case 'daily': date.setDate(date.getDate() + 1); break;
        case 'weekly': date.setDate(date.getDate() + 7); break;
        case 'monthly': date.setMonth(date.getMonth() + 1); break;
      }
      db.prepare('UPDATE tasks SET reminder_time = ? WHERE id = ?').run(date.toISOString(), task.id);
    } else {
      db.prepare('UPDATE tasks SET reminder_time = NULL WHERE id = ?').run(task.id);
    }
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
