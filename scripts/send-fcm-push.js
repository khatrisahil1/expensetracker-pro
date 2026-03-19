#!/usr/bin/env node

/**
 * Simple helper to send a Firebase Cloud Messaging push.
 *
 * Usage:
 *   FCM_SERVER_KEY=YOUR_SERVER_KEY node scripts/send-fcm-push.js <DEVICE_TOKEN> --title "Hello" --body "Test"
 *
 * If no title/body are provided, defaults are used.
 */

const [,, token, ...rest] = process.argv;

if (!token) {
  console.error('Usage: FCM_SERVER_KEY=YOUR_SERVER_KEY node scripts/send-fcm-push.js <DEVICE_TOKEN> [--title "..."] [--body "..."]');
  process.exit(1);
}

const args = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const val = rest[i + 1];
  if (!key || !val) continue;
  if (key.startsWith('--')) {
    args[key.slice(2)] = val;
  }
}

const title = args.title || 'Test Push';
const body = args.body || 'This is a test notification.';
const serverKey = process.env.FCM_SERVER_KEY;

if (!serverKey) {
  console.error('ERROR: Must set FCM_SERVER_KEY environment variable.');
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body },
      }),
    });

    const json = await res.text();
    console.log('FCM response status:', res.status);
    console.log(json);
  } catch (e) {
    console.error('Failed to send push:', e);
    process.exit(1);
  }
})();
