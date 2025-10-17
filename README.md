# Game Server

Simple Express + MongoDB leaderboard server.

Prerequisites
- Node 16+ (or compatible LTS)
- A MongoDB URI (local or cloud)

Quick start (PowerShell):

```powershell
# install deps
npm install

# set env vars for this session
$env:MONGODB_URI = "mongodb://localhost:27017/game"
$env:PORT = "3000"

# run
npm start
```

Endpoints
- POST /scores  -- body: { userId, username, photoUrl?, score }
- GET /scores/top/:limit
- GET /scores/user/:userId

Notes
- The server archives scores older than 7 days into an `ArchiveScore` collection daily. If `node-cron` is installed, it will schedule at 00:05; otherwise a 24h interval fallback is used.
- Add `node-cron` to dependencies if you want precise cron scheduling: `npm install node-cron`.
