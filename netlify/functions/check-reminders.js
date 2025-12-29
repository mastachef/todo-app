import webpush from 'web-push';
import db from './db.js';
import { jsonResponse, errorResponse } from './_helpers.js';

// VAPID keys - set these in Netlify environment variables
// Generate your own at: https://vapidkeys.com/
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKvtHA';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

// Initialize web-push with VAPID credentials
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

// This function is triggered by Netlify Scheduled Functions
// It checks for due reminders and sends push notifications
export async function handler(event) {
  console.log('Check reminders function triggered');
  
  try {
    await db.initDatabase();

    // Create push_subscriptions table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const now = new Date();
    
    // Find tasks with reminders that are due (within last 5 minutes to account for timing)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const dueTasks = await db.queryAll(`
      SELECT t.*, t.user_id as uid
      FROM tasks t
      WHERE t.completed = false 
      AND t.reminder_time IS NOT NULL 
      AND t.reminder_time <= $1
      AND t.reminder_time > $2
    `, [now.toISOString(), fiveMinutesAgo.toISOString()]);

    console.log(`Found ${dueTasks.length} due reminders`);

    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const task of dueTasks) {
      // Get push subscriptions for this user
      const subscriptions = await db.queryAll(
        'SELECT * FROM push_subscriptions WHERE user_id = $1',
        [task.uid]
      );

      console.log(`User ${task.uid} has ${subscriptions.length} push subscriptions`);

      // Send notification to each subscription
      for (const sub of subscriptions) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        const payload = JSON.stringify({
          title: '⏰ Reminder',
          body: task.text,
          data: { taskId: task.id, url: '/' }
        });

        try {
          await webpush.sendNotification(pushSubscription, payload);
          notificationsSent++;
          console.log(`Notification sent for task ${task.id}`);
        } catch (err) {
          console.error(`Failed to send notification:`, err.statusCode, err.body);
          notificationsFailed++;
          
          // Remove invalid subscriptions (410 Gone or 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
            console.log(`Removed invalid subscription ${sub.id}`);
          }
        }
      }

      // Update reminder based on repeat setting
      if (task.reminder_repeat) {
        const reminderDate = new Date(task.reminder_time);
        switch (task.reminder_repeat) {
          case 'hourly':
            reminderDate.setHours(reminderDate.getHours() + 1);
            break;
          case 'daily':
            reminderDate.setDate(reminderDate.getDate() + 1);
            break;
          case 'weekly':
            reminderDate.setDate(reminderDate.getDate() + 7);
            break;
          case 'monthly':
            reminderDate.setMonth(reminderDate.getMonth() + 1);
            break;
        }
        await db.query(
          'UPDATE tasks SET reminder_time = $1 WHERE id = $2',
          [reminderDate.toISOString(), task.id]
        );
        console.log(`Rescheduled task ${task.id} to ${reminderDate.toISOString()}`);
      } else {
        // Clear one-time reminder after sending
        await db.query(
          'UPDATE tasks SET reminder_time = NULL WHERE id = $1',
          [task.id]
        );
        console.log(`Cleared one-time reminder for task ${task.id}`);
      }
    }

    return jsonResponse(200, {
      success: true,
      timestamp: now.toISOString(),
      checked: dueTasks.length,
      sent: notificationsSent,
      failed: notificationsFailed
    });
  } catch (err) {
    console.error('Check reminders error:', err);
    return errorResponse(500, 'Failed to check reminders');
  }
}

// Netlify Scheduled Function configuration
// Runs every minute to check for due reminders
export const config = {
  schedule: "* * * * *"
};

