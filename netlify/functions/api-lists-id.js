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
    
    // Extract list ID from path: /api-lists-id/123 or query param
    const pathParts = event.path.split('/').filter(Boolean);
    const listId = pathParts[pathParts.length - 1] || event.queryStringParameters?.id;

    if (!listId || isNaN(parseInt(listId))) {
      return errorResponse(400, 'Invalid list ID');
    }

    // PUT - Update list
    if (event.httpMethod === 'PUT') {
      const { name } = parseBody(event);
      
      if (!name) {
        return errorResponse(400, 'List name required');
      }

      await db.query(
        'UPDATE lists SET name = $1 WHERE id = $2 AND user_id = $3',
        [name, listId, userId]
      );

      return jsonResponse(200, { success: true });
    }

    // DELETE - Delete list
    if (event.httpMethod === 'DELETE') {
      // Delete all tasks in the list first (cascade should handle this but being explicit)
      await db.query(
        'DELETE FROM tasks WHERE list_id = $1 AND user_id = $2',
        [listId, userId]
      );
      
      await db.query(
        'DELETE FROM lists WHERE id = $1 AND user_id = $2',
        [listId, userId]
      );

      return jsonResponse(200, { success: true });
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('List update error:', err);
    return errorResponse(500, 'Server error');
  }
}

