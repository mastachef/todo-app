import { handleOptions, jsonResponse, errorResponse } from './_helpers.js';

// VAPID keys for web push
// Generate your own at: https://vapidkeys.com/ or use web-push generate-vapid-keys
// Set these as environment variables: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  return jsonResponse(200, { key: VAPID_PUBLIC });
}

