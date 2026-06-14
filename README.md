# SplitwisePro - Shared Expenses App

SplitwisePro is a production-ready web application designed for group expense sharing and cash flow optimization among flatmates. It tracks membership history timelines, processes multi-currency expenses, provides automatic anomaly detection during spreadsheet imports, and generates minimized settlement transactions.

---

## Technologies Used

### Frontend
- **React** with **Vite** (Build Tool)
- **Tailwind CSS** (Styling)
- **React Router v6** (Routing & Route Guards)
- **Axios** (HTTP Client with Auth Interceptors)
- **Lucide React** (Modern Icons)

### Backend
- **Node.js** with **Express.js** (Server Framework)
- **Prisma ORM** (Database mapping and access)
- **JWT (JsonWebToken)** & **bcryptjs** (Auth security)

### Database & Deployment
- **PostgreSQL** hosted on **Neon**
- **Vercel** (Frontend deployment)
- **Render** (Backend deployment)

---

## Environment Variables

### Backend (`backend/.env`)
Create a file named `.env` in the `backend/` directory:
```env
# Database connection URL (PostgreSQL / Neon)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shared_expenses?schema=public"

# Port to run the server on
PORT=5000

# Authentication variables
JWT_SECRET="your_secure_jwt_secret_key"
JWT_EXPIRES_IN="7d"
```

### Frontend (`frontend/.env.local`)
Create a file named `.env.local` in the `frontend/` directory:
```env
VITE_API_URL="http://localhost:5000/api"
```

---

## Setup Instructions

### 1. Database Setup
Ensure you have a PostgreSQL database running locally or on Neon. Run the migrations:
```bash
cd backend
npm install
npx prisma migrate dev --name init
```

### 2. Run Backend Dev Server
```bash
cd backend
npm run dev
```
The backend server will run on `http://localhost:5000`.

### 3. Run Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```
The frontend server will run on `http://localhost:5173`. Open it in your browser.

---

## Deployment Instructions

### Backend (Render)
1. Push the repository to GitHub.
2. Log in to Render and create a new **Web Service**.
3. Link the repository.
4. Set the **Start Command** to `npm start` (or `node src/app.js`).
5. Under Environment, add the `DATABASE_URL` and `JWT_SECRET` variables.
6. Deploy the service.

### Frontend (Vercel)
1. Create a new project on Vercel.
2. Link the repository.
3. Set the root directory to `frontend`.
4. Configure the environment variable `VITE_API_URL` to point to your deployed Render URL (e.g., `https://your-backend.onrender.com/api`).
5. Deploy.
