import bcrypt from 'bcryptjs';
import db from './db.js';
import { handleOptions, jsonResponse, errorResponse, generateToken, parseBody } from './_helpers.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Initialize database tables if needed
    await db.initDatabase();

    const { email, password } = parseBody(event);

    if (!email || !password) {
      return errorResponse(400, 'Email and password required');
    }

    // Find user
    const user = await db.queryOne(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      return errorResponse(401, 'Invalid email or password');
    }

    // Check password
    if (!bcrypt.compareSync(password, user.password)) {
      return errorResponse(401, 'Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user);

    return jsonResponse(200, {
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse(500, 'Login failed');
  }
}

