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

    // Extract task_id from query params
    const params = event.queryStringParameters || {};
    const taskId = params.task_id;

    // GET - Get all subtasks for a task
    if (event.httpMethod === 'GET') {
      if (!taskId) {
        return errorResponse(400, 'Task ID required');
      }

      // Verify task belongs to user
      const task = await db.queryOne(
        'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
        [taskId, userId]
      );

      if (!task) {
        return errorResponse(404, 'Task not found');
      }

      const subtasks = await db.queryAll(
        'SELECT * FROM subtasks WHERE task_id = $1 AND user_id = $2 ORDER BY sort_order ASC, created_at ASC',
        [taskId, userId]
      );

      return jsonResponse(200, subtasks);
    }

    // POST - Create new subtask
    if (event.httpMethod === 'POST') {
      const { task_id, text } = parseBody(event);

      if (!task_id) {
        return errorResponse(400, 'Task ID required');
      }

      if (!text || !text.trim()) {
        return errorResponse(400, 'Subtask text required');
      }

      // Verify task belongs to user
      const task = await db.queryOne(
        'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
        [task_id, userId]
      );

      if (!task) {
        return errorResponse(404, 'Task not found');
      }

      // Get max sort_order for this task
      const maxOrder = await db.queryOne(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM subtasks WHERE task_id = $1',
        [task_id]
      );

      const subtask = await db.queryOne(
        `INSERT INTO subtasks (task_id, user_id, text, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [task_id, userId, text.trim(), (maxOrder.max_order || 0) + 1]
      );

      return jsonResponse(200, subtask);
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Subtasks error:', err);
    return errorResponse(500, 'Server error');
  }
}
