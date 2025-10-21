import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { isActive: true },
      include: {
        creator: { select: { name: true, walletAddress: true } },
        _count: { select: { tickets: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ events });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { walletAddress, eventName, eventURI, ticketPrice, totalTickets, eventDate, blockchainEventId } = req.body;

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user || user.role !== 'EO' || !user.isApproved) {
      return res.status(403).json({ error: 'EO must be approved' });
    }

    const event = await prisma.event.create({
      data: {
        creatorId: user.id,
        blockchainEventId,
        eventName,
        eventURI,
        ticketPrice,
        totalTickets,
        eventDate: new Date(eventDate),
        isActive: true
      }
    });

    res.json({ success: true, event });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
