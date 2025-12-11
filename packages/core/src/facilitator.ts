import { createPublicClient, http, type Hex, type Address } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';
import type {
  FacilitatorConfig,
  PaymentRequirements,
  SettleResponse,
  SupportedKind,
  SupportedResponse,
  VerifyResponse,
  X402PaymentPayload,
  ChainId,
} from './types.js';
import { getChainIdFromNetwork, getNetworkFromChainId, defaultChains } from './chains.js';
import { executeERC3009Settlement } from './erc3009.js';
import { executeSolanaSettlement } from './solana.js';

/**
 * Chain ID to viem chain mapping (EVM chains only)
 */
const viemChains = {
  8453: base,
  84532: baseSepolia,
  1: mainnet,
  11155111: sepolia,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPublicClient = ReturnType<typeof createPublicClient<any, any>>;

/**
 * Check if a chain ID is an EVM chain
 */
function isEVMChain(chainId: ChainId): chainId is number {
  return typeof chainId === 'number';
}

/**
 * Facilitator class for handling x402 payment verification and settlement
 */
export class Facilitator {
  private config: FacilitatorConfig;
  private clients: Map<number, AnyPublicClient> = new Map();

  constructor(config: FacilitatorConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize viem clients for supported EVM chains
   */
  private initializeClients(): void {
    for (const chainId of this.config.supportedChains) {
      // Only initialize clients for EVM chains
      if (!isEVMChain(chainId)) continue;

      const chain = viemChains[chainId as keyof typeof viemChains];
      const chainConfig = defaultChains[String(chainId)];

      if (chain && chainConfig) {
        const client = createPublicClient({
          chain,
          transport: http(chainConfig.rpcUrl),
        }) as AnyPublicClient;
        this.clients.set(chainId, client);
      }
    }
  }

  /**
   * Get the facilitator configuration
   */
  getConfig(): FacilitatorConfig {
    return this.config;
  }

  /**
   * Get supported payment kinds for this facilitator
   */
  getSupported(): SupportedResponse {
    const kinds: SupportedKind[] = [];

    for (const token of this.config.supportedTokens) {
      const network = getNetworkFromChainId(token.chainId);
      if (network) {
        kinds.push({
          scheme: 'exact',
          network,
          asset: token.address,
        });
      }
    }

    return {
      x402Version: 1,
      kinds,
    };
  }

  /**
   * Verify a payment payload
   */
  async verify(
    paymentPayload: string,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      // Parse the base64-encoded payment payload
      const decoded = Buffer.from(paymentPayload, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);

      // Get chain ID from network
      const chainId = getChainIdFromNetwork(requirements.network);
      if (!chainId) {
        return {
          valid: false,
          invalidReason: `Unsupported network: ${requirements.network}`,
        };
      }

      // Check if chain is supported by this facilitator
      const isSupported = this.config.supportedChains.some(
        (c) => String(c) === String(chainId)
      );
      if (!isSupported) {
        return {
          valid: false,
          invalidReason: `Chain ${chainId} not supported by this facilitator`,
        };
      }

      // Handle Solana verification differently
      if (chainId === 'solana' || chainId === 'solana-devnet') {
        // Solana payloads have transaction in payload.payload.transaction
        const solanaPayload = payload.payload || payload;
        if (!solanaPayload.transaction) {
          return {
            valid: false,
            invalidReason: 'Missing transaction in Solana payment payload',
          };
        }
        // For Solana, we trust the pre-signed transaction
        // The actual verification happens during settlement
        return {
          valid: true,
          payer: 'solana-payer', // Payer is embedded in the transaction
        };
      }

      // EVM verification
      if (isEVMChain(chainId)) {
        const client = this.clients.get(chainId);
        if (!client) {
          return {
            valid: false,
            invalidReason: `No client configured for chain ${chainId}`,
          };
        }

        // Validate the ERC-3009 authorization
        const { authorization } = payload as X402PaymentPayload;
        if (!authorization) {
          return {
            valid: false,
            invalidReason: 'Missing authorization in EVM payment payload',
          };
        }

        // Check timestamp validity
        const now = Math.floor(Date.now() / 1000);
        if (authorization.validAfter > now) {
          return {
            valid: false,
            invalidReason: 'Payment not yet valid',
          };
        }
        if (authorization.validBefore < now) {
          return {
            valid: false,
            invalidReason: 'Payment has expired',
          };
        }

        // Check amount meets requirements
        const paymentAmount = BigInt(authorization.value);
        const requiredAmount = BigInt(requirements.maxAmountRequired);
        if (paymentAmount < requiredAmount) {
          return {
            valid: false,
            invalidReason: `Payment amount ${paymentAmount} is less than required ${requiredAmount}`,
          };
        }

        return {
          valid: true,
          payer: authorization.from,
        };
      }

      return {
        valid: false,
        invalidReason: `Unknown chain type: ${chainId}`,
      };
    } catch (error) {
      return {
        valid: false,
        invalidReason: error instanceof Error ? error.message : 'Unknown error during verification',
      };
    }
  }

  /**
   * Settle a payment (execute the transfer)
   */
  async settle(
    paymentPayload: string,
    requirements: PaymentRequirements,
    privateKey?: string // Can be Hex for EVM or base58 for Solana
  ): Promise<SettleResponse> {
    try {
      // First verify the payment
      const verification = await this.verify(paymentPayload, requirements);
      if (!verification.valid) {
        return {
          success: false,
          errorMessage: verification.invalidReason,
          network: requirements.network,
        };
      }

      // Parse payload
      const decoded = Buffer.from(paymentPayload, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);

      const chainId = getChainIdFromNetwork(requirements.network);
      if (!chainId) {
        return {
          success: false,
          errorMessage: `Unsupported network: ${requirements.network}`,
          network: requirements.network,
        };
      }

      if (!privateKey) {
        return {
          success: false,
          errorMessage: 'Private key required for settlement',
          network: requirements.network,
        };
      }

      // Handle Solana chains FIRST (before EVM check)
      if (chainId === 'solana' || chainId === 'solana-devnet') {
        // Solana payload structure: { payload: { transaction: "...", signature: "..." } }
        const solanaPayload = payload.payload || payload;
        const signedTransaction = solanaPayload.transaction;
        
        if (!signedTransaction) {
          return {
            success: false,
            errorMessage: 'Missing transaction in Solana payment payload',
            network: requirements.network,
          };
        }

        // For Solana, private key is base58 encoded (not hex)
        const result = await executeSolanaSettlement({
          network: chainId as 'solana' | 'solana-devnet',
          signedTransaction,
          facilitatorPrivateKey: privateKey,
        });

        if (result.success) {
          return {
            success: true,
            transactionHash: result.transactionHash,
            network: requirements.network,
          };
        } else {
          return {
            success: false,
            errorMessage: result.errorMessage,
            network: requirements.network,
          };
        }
      }

      // Handle EVM chains (Base, Ethereum)
      if (isEVMChain(chainId)) {
        const evmPayload = payload as X402PaymentPayload;
        
        if (!evmPayload.authorization) {
          return {
            success: false,
            errorMessage: 'Missing authorization in EVM payment payload',
            network: requirements.network,
          };
        }

        const result = await executeERC3009Settlement({
          chainId,
          tokenAddress: requirements.asset as Address,
          authorization: {
            from: evmPayload.authorization.from as Address,
            to: evmPayload.authorization.to as Address,
            value: evmPayload.authorization.value,
            validAfter: evmPayload.authorization.validAfter,
            validBefore: evmPayload.authorization.validBefore,
            nonce: evmPayload.authorization.nonce as Hex,
          },
          signature: evmPayload.signature as Hex,
          facilitatorPrivateKey: privateKey as Hex,
        });

        if (result.success) {
          return {
            success: true,
            transactionHash: result.transactionHash,
            network: requirements.network,
          };
        } else {
          return {
            success: false,
            errorMessage: result.errorMessage,
            network: requirements.network,
          };
        }
      }

      return {
        success: false,
        errorMessage: `Unknown chain type: ${chainId}`,
        network: requirements.network,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error during settlement',
        network: requirements.network,
      };
    }
  }
}

/**
 * Create a new facilitator instance
 */
export function createFacilitator(config: FacilitatorConfig): Facilitator {
  return new Facilitator(config);
}
