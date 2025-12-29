import { handleOptions, jsonResponse, errorResponse } from './_helpers.js';

// VAPID keys for web push - MUST match between client subscription and server sending
// These are the keys generated for this app - set in Netlify env vars for production
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BPaRdrXvX8_-BOxAJ2n6mf4_qYqa1EVKlW7y4EDY6xHMh3emtgG_ygjWlbXKTtYASJLrbc6svLQVYiwmGIX4yCc';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  console.log('VAPID public key requested');
  return jsonResponse(200, { key: VAPID_PUBLIC });
}

