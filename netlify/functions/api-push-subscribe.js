import db from './db.js';
import { handleOptions, jsonResponse, errorResponse, requireAuth, parseBody } from './_helpers.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Initialize database
    await db.initDatabase();

    // Create push_subscriptions table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Check authentication
    const auth = requireAuth(event);
    if (auth.error) {
      return auth.error;
    }

    const body = parseBody(event);
    const subscription = body.subscription;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return errorResponse(400, 'Invalid subscription data');
    }

    const userId = auth.user.userId;
    const { endpoint, keys } = subscription;

    // Delete existing subscription for this endpoint (if any)
    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);

    // Insert new subscription
    await db.query(
      'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
      [userId, endpoint, keys.p256dh, keys.auth]
    );

    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error('Push subscription error:', err);
    return errorResponse(500, 'Failed to save subscription');
  }
}

