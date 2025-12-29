import db from './db.js';
import { handleOptions, jsonResponse, errorResponse, requireAuth } from './_helpers.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Initialize database tables if needed
    await db.initDatabase();

    // Check authentication
    const auth = requireAuth(event);
    if (auth.error) {
      // Return null user instead of error for /me endpoint
      return jsonResponse(200, { user: null });
    }

    // Get user from database
    const user = await db.queryOne(
      'SELECT id, email, name FROM users WHERE id = $1',
      [auth.user.userId]
    );

    if (!user) {
      return jsonResponse(200, { user: null });
    }

    return jsonResponse(200, { user });
  } catch (err) {
    console.error('Auth check error:', err);
    return jsonResponse(200, { user: null });
  }
}

