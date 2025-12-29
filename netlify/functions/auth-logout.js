import { handleOptions, jsonResponse } from './_helpers.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  // JWT tokens are stateless, so logout is handled client-side
  // by removing the token from localStorage
  return jsonResponse(200, { success: true });
}

