import db from './db.js';
import { handleOptions, jsonResponse, errorResponse, requireAuth } from './_helpers.js';

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

    // GET - Search tasks
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const query = params.q || '';

      if (!query.trim()) {
        return jsonResponse(200, []);
      }

      // Search in task text and notes using ILIKE for case-insensitive matching
      const searchPattern = `%${query}%`;

      const tasks = await db.queryAll(
        `SELECT t.*, l.name as list_name
         FROM tasks t
         JOIN lists l ON t.list_id = l.id
         WHERE t.user_id = $1
         AND (t.text ILIKE $2 OR t.notes ILIKE $2)
         ORDER BY t.created_at DESC
         LIMIT 50`,
        [userId, searchPattern]
      );

      return jsonResponse(200, tasks);
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Search error:', err);
    return errorResponse(500, 'Server error');
  }
}
