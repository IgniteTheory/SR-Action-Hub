import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import requestTypeRoutes from './routes/requestTypes';
import actionRoutes from './routes/actions';
import dashboardRoutes from './routes/dashboard';
import quoteRoutes from './routes/quotes';

const app = express();

// Behind Render's proxy — trust X-Forwarded-Proto so req.protocol reports
// "https" correctly (used to build the quote links we email to clients).
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/request-types', requestTypeRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/dashboard', dashboardRoutes);
// No requireAuth here — this is the client-facing quote accept/decline link.
app.use('/api/quotes', quoteRoutes);

// In production the frontend is built and served from the same service as
// the API, so there's one URL and no CORS to think about. Locally, the
// frontend runs on its own Vite dev server instead, so this build won't
// exist and the block below is skipped.
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

export default app;
