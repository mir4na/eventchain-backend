import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  try {
    const { walletAddress, role, name, email } = req.body;
    const user = await prisma.user.create({
      data: {
        walletAddress: walletAddress.toLowerCase(),
        role: role || 'BUYER',
        name,
        email,
        isApproved: role === 'BUYER'
      }
    });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
