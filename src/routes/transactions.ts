import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/record', async (req, res) => {
  try {
    const { txHash, eventId, buyerAddress, ticketId, amount, type } = req.body;

    const transaction = await prisma.transaction.create({
      data: {
        txHash,
        eventId,
        buyerAddress: buyerAddress.toLowerCase(),
        ticketId,
        amount,
        type
      }
    });

    res.json({ success: true, transaction });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
