import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: { proposals: true, events: true }
    });

    res.json({ user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
