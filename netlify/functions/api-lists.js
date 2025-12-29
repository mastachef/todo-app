import db from './db.js';
import { handleOptions, jsonResponse, errorResponse, requireAuth, parseBody } from './_helpers.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // Initialize database tables if needed
    await db.initDatabase();

    // Check authentication
    const auth = requireAuth(event);
    if (auth.error) {
      return auth.error;
    }

    const userId = auth.user.userId;

    // GET - Get all lists for user
    if (event.httpMethod === 'GET') {
      const lists = await db.queryAll(
        'SELECT * FROM lists WHERE user_id = $1 ORDER BY created_at',
        [userId]
      );
      return jsonResponse(200, lists);
    }

    // POST - Create new list
    if (event.httpMethod === 'POST') {
      const { name } = parseBody(event);
      
      if (!name) {
        return errorResponse(400, 'List name required');
      }

      const list = await db.queryOne(
        'INSERT INTO lists (user_id, name) VALUES ($1, $2) RETURNING *',
        [userId, name]
      );

      return jsonResponse(200, list);
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Lists error:', err);
    return errorResponse(500, 'Server error');
  }
}

