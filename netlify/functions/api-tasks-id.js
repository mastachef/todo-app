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
    
    // Extract task ID from path: /api-tasks-id/123 or query param
    const pathParts = event.path.split('/').filter(Boolean);
    const taskId = pathParts[pathParts.length - 1] || event.queryStringParameters?.id;

    if (!taskId || isNaN(parseInt(taskId))) {
      return errorResponse(400, 'Invalid task ID');
    }

    // GET - Get single task
    if (event.httpMethod === 'GET') {
      const task = await db.queryOne(
        'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
        [taskId, userId]
      );

      if (!task) {
        return errorResponse(404, 'Task not found');
      }

      return jsonResponse(200, task);
    }

    // PUT - Update task
    if (event.httpMethod === 'PUT') {
      // Get existing task
      const existingTask = await db.queryOne(
        'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
        [taskId, userId]
      );

      if (!existingTask) {
        return errorResponse(404, 'Task not found');
      }

      const { text, notes, priority, completed, reminder_time, reminder_repeat, recurrence, is_focused } = parseBody(event);

      // Calculate completed_at
      let completedAt = existingTask.completed_at;
      if (completed && !existingTask.completed) {
        completedAt = new Date().toISOString();
      } else if (!completed) {
        completedAt = null;
      }

      const updatedTask = await db.queryOne(
        `UPDATE tasks
         SET text = $1, notes = $2, priority = $3, completed = $4, completed_at = $5,
             reminder_time = $6, reminder_repeat = $7, recurrence = $8, is_focused = $9
         WHERE id = $10 AND user_id = $11
         RETURNING *`,
        [
          text ?? existingTask.text,
          notes ?? existingTask.notes,
          priority ?? existingTask.priority,
          completed ?? existingTask.completed,
          completedAt,
          reminder_time !== undefined ? reminder_time : existingTask.reminder_time,
          reminder_repeat !== undefined ? reminder_repeat : existingTask.reminder_repeat,
          recurrence !== undefined ? recurrence : existingTask.recurrence,
          is_focused !== undefined ? is_focused : existingTask.is_focused,
          taskId,
          userId
        ]
      );

      return jsonResponse(200, updatedTask);
    }

    // DELETE - Delete task
    if (event.httpMethod === 'DELETE') {
      await db.query(
        'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
        [taskId, userId]
      );

      return jsonResponse(200, { success: true });
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Task update error:', err);
    return errorResponse(500, 'Server error');
  }
}

