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

    // GET - Get all tasks for user
    if (event.httpMethod === 'GET') {
      const tasks = await db.queryAll(
        'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return jsonResponse(200, tasks);
    }

    // POST - Create new task
    if (event.httpMethod === 'POST') {
      const { list_id, text, notes, priority, reminder_time, reminder_repeat, recurrence } = parseBody(event);
      
      if (!text) {
        return errorResponse(400, 'Task text required');
      }

      if (!list_id) {
        return errorResponse(400, 'List ID required');
      }

      // Verify the list belongs to the user
      const list = await db.queryOne(
        'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
        [list_id, userId]
      );

      if (!list) {
        return errorResponse(404, 'List not found');
      }

      const task = await db.queryOne(
        `INSERT INTO tasks (list_id, user_id, text, notes, priority, reminder_time, reminder_repeat, recurrence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [list_id, userId, text, notes || '', priority || 'none', reminder_time || null, reminder_repeat || null, recurrence || null]
      );

      return jsonResponse(200, task);
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Tasks error:', err);
    return errorResponse(500, 'Server error');
  }
}

