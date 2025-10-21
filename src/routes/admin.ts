import express from 'express';
import { PrismaClient } from '@prisma/client';
import { upload } from '../config/multer';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/proposal', upload.single('proposal'), async (req, res) => {
  try {
    const { walletAddress, eventName, description } = req.body;

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user || user.role !== 'EO') {
      return res.status(403).json({ error: 'Only EO can submit proposals' });
    }

    const proposal = await prisma.proposal.create({
      data: {
        userId: user.id,
        eventName,
        description,
        proposalFile: req.file?.path,
        status: 'PENDING'
      }
    });

    res.json({ success: true, proposal });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
