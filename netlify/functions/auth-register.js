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

    const { email, password, name } = parseBody(event);

    if (!email || !password) {
      return errorResponse(400, 'Email and password required');
    }

    if (password.length < 6) {
      return errorResponse(400, 'Password must be at least 6 characters');
    }

    // Check if user already exists
    const existing = await db.queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing) {
      return errorResponse(400, 'Email already registered');
    }

    // Hash password and create user
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await db.queryOne(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email.toLowerCase(), hashedPassword, name || email.split('@')[0]]
    );

    // Create default list for user
    await db.query(
      'INSERT INTO lists (user_id, name) VALUES ($1, $2)',
      [result.id, 'My Tasks']
    );

    // Generate JWT token
    const token = generateToken(result);

    return jsonResponse(200, {
      user: { id: result.id, email: result.email, name: result.name },
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return errorResponse(500, 'Registration failed');
  }
}

