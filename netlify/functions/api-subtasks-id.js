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

    // Extract subtask ID from path
    const pathParts = event.path.split('/').filter(Boolean);
    const subtaskId = pathParts[pathParts.length - 1] || event.queryStringParameters?.id;

    if (!subtaskId || isNaN(parseInt(subtaskId))) {
      return errorResponse(400, 'Invalid subtask ID');
    }

    // Verify subtask belongs to user
    const existingSubtask = await db.queryOne(
      'SELECT * FROM subtasks WHERE id = $1 AND user_id = $2',
      [subtaskId, userId]
    );

    if (!existingSubtask) {
      return errorResponse(404, 'Subtask not found');
    }

    // GET - Get single subtask
    if (event.httpMethod === 'GET') {
      return jsonResponse(200, existingSubtask);
    }

    // PUT - Update subtask
    if (event.httpMethod === 'PUT') {
      const { text, completed, sort_order } = parseBody(event);

      const updatedSubtask = await db.queryOne(
        `UPDATE subtasks
         SET text = $1, completed = $2, sort_order = $3
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [
          text !== undefined ? text : existingSubtask.text,
          completed !== undefined ? completed : existingSubtask.completed,
          sort_order !== undefined ? sort_order : existingSubtask.sort_order,
          subtaskId,
          userId
        ]
      );

      return jsonResponse(200, updatedSubtask);
    }

    // DELETE - Delete subtask
    if (event.httpMethod === 'DELETE') {
      await db.query(
        'DELETE FROM subtasks WHERE id = $1 AND user_id = $2',
        [subtaskId, userId]
      );

      return jsonResponse(200, { success: true });
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Subtask update error:', err);
    return errorResponse(500, 'Server error');
  }
}
