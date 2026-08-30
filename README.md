# Social Media Content Manager — Node.js + MongoDB

This project converts the supplied single-file Social Media Content Manager into a real full-stack app. The supplied UI remains the frontend; authentication, users, posts, profiles and analytics data are stored server-side in MongoDB instead of browser localStorage.

The original UI includes Dashboard, Create Post, Content Calendar, Monthly Calendar, Analytics, Reports, Profile and an admin-only Users page. It supports Instagram, Facebook, Twitter / X and LinkedIn, plus Awareness, Educational, Event, Fundraising and Community Update post types. fileciteturn1file4L294-L303 fileciteturn1file3L237-L275

## Stack
- Frontend: existing HTML/CSS/JavaScript UI
- Backend: Node.js + Express
- Database: MongoDB / MongoDB Atlas
- Auth: bcrypt password hashing + JWT

## Important
For a phone/Termux setup, **MongoDB Atlas is recommended**. Running a local `mongod` binary directly on Android/Termux is not the easiest supported path across devices. Your Node.js app can run entirely in Termux while MongoDB runs in Atlas.

## Termux — step by step

### 1. Install Termux
Install Termux from a trusted source such as F-Droid/GitHub rather than an old Play Store build.

### 2. Update packages
```bash
pkg update && pkg upgrade -y
```

### 3. Install Node.js and Git
```bash
pkg install nodejs git nano unzip -y
node -v
npm -v
```

### 4. Put the project in Termux
If you downloaded the ZIP to Android Downloads:
```bash
termux-setup-storage
cd ~/storage/downloads
unzip smcp-fullstack.zip
cd smcp-fullstack
```

Or copy the project folder into Termux and `cd` into it.

### 5. Create MongoDB Atlas database
1. Create a MongoDB Atlas account.
2. Create a free/shared cluster.
3. Create a database user and password.
4. Add your IP to the Atlas Network Access list. For testing, Atlas may allow `0.0.0.0/0`; restrict this later for production.
5. Copy the Node.js connection string.

Example format:
```text
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/social_media_manager?retryWrites=true&w=majority
```

### 6. Create `.env`
```bash
cp .env.example .env
nano .env
```

Set:
```env
PORT=3000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/social_media_manager?retryWrites=true&w=majority
JWT_SECRET=put-a-long-random-secret-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
```

Save in nano: `CTRL+O`, Enter, then `CTRL+X`.

### 7. Install dependencies
```bash
npm install
```

### 8. Start the app
```bash
npm start
```

You should see something like:
```text
MongoDB connected.
Seeded admin: admin
Server running at http://127.0.0.1:3000
```

### 9. Open it on your phone
Open Chrome/Firefox and visit:
```text
http://127.0.0.1:3000
```

Admin login is the values in `.env` (default: `admin` / `admin123`). Change the default password before real use.

## Useful Termux commands

Stop server:
```text
CTRL+C
```

Start again:
```bash
cd ~/smcp-fullstack
npm start
```

Run with Node's watch mode during development:
```bash
npm run dev
```

Check API health:
```bash
curl http://127.0.0.1:3000/api/health
```

## What changed from the supplied HTML
The supplied version originally stored users/posts/profile data in browser localStorage and seeded an admin account with default credentials. fileciteturn3file0L16-L42 Authentication and registration also used localStorage directly. fileciteturn3file0L125-L176

This version moves those responsibilities to Express/MongoDB. The frontend still keeps only a short-lived session/token and UI cache in localStorage; MongoDB is the persistent source of truth.

Post creation in the original UI has title, platform, type, status, date, time, content and optional image fields. fileciteturn3file1L393-L432 Published posts also receive engagement numbers in the original prototype; the backend keeps that behavior for demo analytics. fileciteturn4file0L35-L42

## Main API routes
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot`
- `GET /api/posts`
- `POST /api/posts`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/users` — admin only
- `DELETE /api/users/:username` — admin only
- `GET /api/health`

## Security before production
- Change `ADMIN_PASSWORD`.
- Use a strong random `JWT_SECRET`.
- Do not commit `.env`.
- Restrict Atlas Network Access instead of leaving `0.0.0.0/0` open.
- Add rate limiting, CSRF protection where applicable, stronger validation, HTTPS and a real password-reset email flow before public deployment.
- For large-scale image storage, move images from MongoDB documents to object storage/GridFS rather than keeping base64 data in documents.

## Social platform publishing
The original supplied UI is a planner/analytics application; it does **not** contain real Instagram/Facebook/X/LinkedIn publishing API credentials or platform OAuth flows. The full-stack conversion therefore stores planned posts and demo engagement data, but does not pretend to publish to those networks. Real publishing requires separate OAuth/API integrations for each platform.
