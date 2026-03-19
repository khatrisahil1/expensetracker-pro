<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ExpenseTracker Pro

Track your expenses, set budgets, and get smart insights powered by Gemini.

---

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set your keys:
   - `GEMINI_API_KEY` (Gemini AI integration)
   - `VITE_FCM_VAPID_KEY` (Firebase Push notifications)
3. Run the app:
   ```bash
   npm run dev
   ```

---

## Sending a test push notification (device-level)

To verify device-level push notifications, you need:

1. A **push token** (shown in Settings → Notifications after enabling notifications).
2. An **FCM server key** (from Firebase Console → Project settings → Cloud Messaging).

### Option A: Run a local script (recommended)

1. Add `FCM_SERVER_KEY` to your environment (don’t commit this key):
   ```bash
   export FCM_SERVER_KEY="YOUR_SERVER_KEY"
   ```
2. Run the helper script:
   ```bash
   npm run send-push -- <DEVICE_TOKEN> --title "Test Push" --body "Hello from ExpenseTracker"
   ```

### Option B: Use curl directly

```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<DEVICE_TOKEN>",
    "notification": {
      "title": "Test Push",
      "body": "Hello from ExpenseTracker"
    }
  }'
```

---

## Notes

- Push notifications require **HTTPS** (or localhost).
- iOS Safari does not support web push, so this only works in supported browsers (Chrome/Edge/Firefox on desktop/mobile).
