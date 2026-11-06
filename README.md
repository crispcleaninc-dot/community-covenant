# Community Covenant

"You are not alone. Keep pushing one more day. Don't give up in God."

Live: https://crispcleaninc-dot.github.io/community-covenant/  (landing page)
App:  https://crispcleaninc-dot.github.io/community-covenant/app/

## How it fits together
- `index.html` – landing page with the how-it-works video
- `app/index.html` – the Community Covenant app (same app as the Apps Script version, nothing removed)
  - Screen-Time Breaks (Nov 6 2026): break reminders, Covenant Originals skits & commercials, and credited sermon/skit clips from the creators' own YouTube channels, matched to age, interests, daily focus, covenant day and last Bible study. Kids only see kid content. Welcome tiles open help / His creation reels / Your people (Facebook group + Linktree).
- `app/bridge.js` – sends the app's `google.script.run` calls to the Apps Script server
- `app/connect.js` – add-ons: install to home screen, how-it-works video, chat button, Scripture-backed Ask for Help, speak-to-type mic on every box, phone notifications
- `chat.html` – members chat with the team · `team.html` – the team desk (TEAM_PIN)
- `config.js` – the server link (change only this if the Apps Script deployment link ever changes)
- `server/CovenantConnect.gs` – copy of the server add-on (the live copy is in the Apps Script project "Community Covenant", last file)

Server settings live in Apps Script → Project Settings → Script properties (APP_HOME_URL, TEAM_PIN, ANTHROPIC_API_KEY, ONESIGNAL_APP_ID, ONESIGNAL_REST_KEY, REPLIES).

## Offline (Nov 6 2026)
- `app/bridge.js` keeps every answer the app reads on the device and queues every save made offline; the queue uploads in order when the connection returns (status bar at the top shows Offline / uploading / all caught up).
- `sw.js` keeps the app files, fonts, photos already seen, and every skit and Wisdom Reels recording on the device.
- When you add new recordings, regenerate `assets/offline-files.json` (list of every .mp3 under assets/) so they are saved for offline use too.
- Needs the internet: creating an account, password reset, Scripture AI answers (the question is kept for the team), YouTube sermon clips and gospel radio, the how-it-works video.
