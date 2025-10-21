import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import adminRoutes from './routes/admin';
import eoRoutes from './routes/eo';
import eventRoutes from './routes/events';
import transactionRoutes from './routes/transactions';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/eo', eoRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/user', userRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));