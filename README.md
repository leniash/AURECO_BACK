# Africa University Student Recommendation & Portfolio Backend

Production backend service for Africa University Student Portfolio, built with Node.js, Express, Neon PostgreSQL, and Google Gemini AI.

## Features
- **Authentication**: Secure JWT-based authentication with bcrypt password hashing across 4 university roles (`student`, `staff`, `supervisor`, `admin`).
- **Student Registration**: Automated verification against official university registry records with 2-step verification code flow and administrator approval.
- **Neon Cloud PostgreSQL**: High-performance serverless PostgreSQL persistence with connection pooling.
- **AI Recommendation Engine**: Powered by Google Gemini AI to assist lecturers in drafting personalized recommendation letters and generating student portfolio audits.
- **Email Notifications**: Automated notification dispatches for verification codes, letter requests, approvals, and status changes.
- **Single-Source State Sync**: Full compatibility with the Africa University frontend single-page architecture.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL`: Your Neon PostgreSQL connection string.
- `JWT_SECRET`: Random secure secret.
- `GEMINI_API_KEY`: Google Gemini API key.
- `FRONTEND_URL`: URL of the deployed Vercel frontend.

### 3. Run Migrations & Seed Data
```bash
npm run migrate
npm run seed
```

### 4. Start Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Deployment to Render
1. Push this repository to GitHub: `https://github.com/mushayapokuvakat-ai/AURECO_BACK`
2. In Render Dashboard, click **New +** -> **Web Service** and connect this repository (or use the included `render.yaml` Blueprint).
3. Set the Environment Variables:
   - `DATABASE_URL`: `postgresql://<user>:<password>@<neon-host>/neondb?sslmode=require`
   - `GEMINI_API_KEY`: `<Your Gemini Key>`
   - `JWT_SECRET`: `<Random 32-char secret>`
   - `FRONTEND_URL`: `<Your Vercel URL>`
4. Build Command: `npm install`
5. Start Command: `npm start`
