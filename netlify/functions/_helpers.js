import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES_IN = '30d';

// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Handle OPTIONS preflight requests
export function handleOptions() {
  return {
    statusCode: 204,
    headers: corsHeaders,
    body: ''
  };
}

// Create JSON response
export function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data)
  };
}

// Error response helper
export function errorResponse(statusCode, message) {
  return jsonResponse(statusCode, { error: message });
}

// Generate JWT token
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Extract token from Authorization header
export function getTokenFromHeader(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Auth middleware - extracts and verifies user from token
export function requireAuth(event) {
  const token = getTokenFromHeader(event);
  if (!token) {
    return { error: errorResponse(401, 'No token provided') };
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return { error: errorResponse(401, 'Invalid or expired token') };
  }
  
  return { user: decoded };
}

// Parse request body
export function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch (err) {
    return {};
  }
}

// Get path parameter (for dynamic routes like /api/tasks/123)
export function getPathParam(event, paramName) {
  // Netlify provides path parameters in event.path
  // For /api/tasks/123, we extract 123
  const pathParts = event.path.split('/').filter(Boolean);
  // The ID is typically the last segment
  return pathParts[pathParts.length - 1];
}

