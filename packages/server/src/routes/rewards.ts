import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../utils/admin.js';
import {
  createRewardAddress,
  getRewardAddressesByUser,
  getRewardAddressByAddress,
  getRewardAddressById,
  verifyRewardAddress,
  deleteRewardAddress,
  isUserEnrolledInRewards,
} from '../db/reward-addresses.js';
import { isFacilitatorOwner } from '../db/facilitators.js';
import {
  verifySolanaSignature,
  createVerificationMessage,
} from '../utils/solana-verify.js';
import {
  verifyEVMSignature,
  createEVMVerificationMessage,
} from '../utils/evm-verify.js';
import { createDailySnapshots } from '../db/volume-aggregation.js';

const router: IRouter = Router();

/**
 * GET /status
 * Get the current user's rewards status
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const hasAddresses = isUserEnrolledInRewards(userId);
    const isUserAdmin = isAdmin(userId);
    const isOwner = isFacilitatorOwner(userId);
    const addresses = getRewardAddressesByUser(userId);

    // Enrolled if: has registered addresses OR owns a facilitator (auto-enrolled)
    const isEnrolled = hasAddresses || isOwner;

    res.json({
      isEnrolled,
      isAdmin: isUserAdmin,
      isFacilitatorOwner: isOwner,
      addresses,
    });
  } catch (error) {
    console.error('Error getting rewards status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get rewards status',
    });
  }
});

// Maximum addresses per user (per RESEARCH.md recommendation)
const MAX_ADDRESSES_PER_USER = 5;

// Validation schema for enrollment
const enrollSchema = z.object({
  chain_type: z.enum(['solana', 'evm']),
  address: z.string().min(1, 'Address is required'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /enroll
 * Enroll a wallet address for rewards tracking
 *
 * Requires cryptographic proof of address ownership via signature verification.
 * Flow: client signs verification message -> server verifies -> address saved as verified
 */
router.post('/enroll', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const parseResult = enrollSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        message: parseResult.error.errors[0]?.message || 'Invalid request body',
      });
      return;
    }

    const { chain_type, address, signature, message } = parseResult.data;

    // Verify signature based on chain type
    if (chain_type === 'solana') {
      const expectedMessage = createVerificationMessage(address);
      if (message !== expectedMessage) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Message format mismatch',
        });
        return;
      }

      if (!verifySolanaSignature(address, signature, message)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid signature - could not verify address ownership',
        });
        return;
      }
    } else if (chain_type === 'evm') {
      const expectedMessage = createEVMVerificationMessage(address);
      if (message !== expectedMessage) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Message format mismatch',
        });
        return;
      }

      if (!(await verifyEVMSignature(address, signature, message))) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid signature - could not verify address ownership',
        });
        return;
      }
    }

    // Check global uniqueness - one address per user globally
    const existingAddress = getRewardAddressByAddress(address, chain_type);
    if (existingAddress) {
      res.status(409).json({
        error: 'Conflict',
        message: 'This address is already registered',
      });
      return;
    }

    // Check address limit per user
    const userAddresses = getRewardAddressesByUser(userId);
    if (userAddresses.length >= MAX_ADDRESSES_PER_USER) {
      res.status(400).json({
        error: 'Limit reached',
        message: `You've reached the maximum number of addresses (${MAX_ADDRESSES_PER_USER})`,
      });
      return;
    }

    // Create the reward address
    const created = createRewardAddress({
      user_id: userId,
      chain_type,
      address,
    });

    if (!created) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Address already enrolled or duplicate entry',
      });
      return;
    }

    // Immediately mark as verified (atomic flow per CONTEXT.md)
    verifyRewardAddress(created.id);

    // Re-fetch to get updated verification status
    const verified = getRewardAddressById(created.id);

    res.status(201).json(verified);
  } catch (error) {
    console.error('Error enrolling address:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to enroll address',
    });
  }
});

/**
 * DELETE /addresses/:id
 * Remove a reward address from user's account
 */
router.delete('/addresses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const addressId = req.params.id;

    // Verify ownership - get address and check user_id matches
    const address = getRewardAddressById(addressId);

    if (!address) {
      res.status(404).json({
        error: 'Not found',
        message: 'Address not found',
      });
      return;
    }

    if (address.user_id !== userId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only remove your own addresses',
      });
      return;
    }

    const deleted = deleteRewardAddress(addressId);

    if (!deleted) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete address',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reward address:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete address',
    });
  }
});

/**
 * POST /snapshot
 * Create daily volume snapshots (called by external cron scheduler)
 * Requires CRON_SECRET header for authentication
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    // Verify cron secret
    const cronSecret = req.headers['x-cron-secret'];
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get campaign ID from request body
    const { campaignId } = req.body;
    if (!campaignId) {
      res.json({ message: 'No campaign specified', processed: 0 });
      return;
    }

    // Create snapshots for today (UTC)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const processed = createDailySnapshots(campaignId, today);

    res.json({
      message: 'Snapshot complete',
      processed,
      date: today,
      campaignId,
    });
  } catch (error) {
    console.error('Error creating volume snapshots:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create volume snapshots',
    });
  }
});

export const rewardsRouter = router;
