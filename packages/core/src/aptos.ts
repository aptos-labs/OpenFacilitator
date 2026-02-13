import {
  Aptos,
  AptosConfig,
  Network,
  NetworkToNodeAPI,
  SimpleTransaction,
  AccountAuthenticator,
  AccountAddress,
  Deserializer,
  Ed25519PublicKey,
  type EntryFunction,
  type TransactionPayload,
  type TransactionPayloadEntryFunction,
} from '@aptos-labs/ts-sdk';

// ===== Constants =====

export const APTOS_MAINNET_CAIP2 = 'aptos:1';
export const APTOS_TESTNET_CAIP2 = 'aptos:2';

export const USDC_MAINNET_FA = '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
export const USDC_TESTNET_FA = '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832';

export const APTOS_TRANSFER_FUNCTION = '0x1::primary_fungible_store::transfer';

// ===== Types =====

export interface AptosSettlementParams {
  network: string; // CAIP-2 format (aptos:1, aptos:2) or v1 ID (aptos, aptos-testnet)
  signedTransaction: string; // base64 encoded payload
  expectedRecipient?: string;
  expectedAmount?: string;
  expectedAsset?: string;
}

export interface AptosSettlementResult {
  success: boolean;
  transactionHash?: string;
  payer?: string;
  errorMessage?: string;
}

interface DecodedAptosPayload {
  transaction: number[];
  senderAuthenticator: number[];
}

// ===== Helpers =====

function getAptosChainId(network: string): number {
  if (network === APTOS_MAINNET_CAIP2 || network === 'aptos') return 1;
  if (network === APTOS_TESTNET_CAIP2 || network === 'aptos-testnet') return 2;
  throw new Error(`Unknown Aptos network: ${network}`);
}

function getAptosNetwork(network: string): Network {
  const chainId = getAptosChainId(network);
  return chainId === 1 ? Network.MAINNET : Network.TESTNET;
}

function isEntryFunctionPayload(
  payload: TransactionPayload,
): payload is TransactionPayloadEntryFunction {
  return 'entryFunction' in payload;
}

/**
 * Create an Aptos SDK client for the given network
 */
export function createAptosClient(network: string, rpcUrl?: string): Aptos {
  const aptosNetwork = getAptosNetwork(network);
  const fullnodeUrl = rpcUrl || NetworkToNodeAPI[aptosNetwork];

  const config = new AptosConfig({
    network: aptosNetwork,
    fullnode: fullnodeUrl,
  });

  return new Aptos(config);
}

/**
 * Deserialize an Aptos payment payload from base64
 */
export function deserializeAptosPayment(transactionBase64: string): {
  transaction: SimpleTransaction;
  senderAuthenticator: AccountAuthenticator;
  entryFunction?: EntryFunction;
} {
  const decoded = Buffer.from(transactionBase64, 'base64').toString('utf8');
  const parsed: DecodedAptosPayload = JSON.parse(decoded);

  const transactionBytes = Uint8Array.from(parsed.transaction);
  const transaction = SimpleTransaction.deserialize(new Deserializer(transactionBytes));

  const authBytes = Uint8Array.from(parsed.senderAuthenticator);
  const senderAuthenticator = AccountAuthenticator.deserialize(new Deserializer(authBytes));

  if (!isEntryFunctionPayload(transaction.rawTransaction.payload)) {
    return { transaction, senderAuthenticator };
  }

  const entryFunction = transaction.rawTransaction.payload.entryFunction;
  return { transaction, senderAuthenticator, entryFunction };
}

/**
 * Execute Aptos settlement: verify and submit a pre-signed transaction.
 * No facilitator private key needed — just relay the client's signed transaction.
 */
export async function executeAptosSettlement(
  params: AptosSettlementParams,
): Promise<AptosSettlementResult> {
  const { network, signedTransaction, expectedRecipient, expectedAmount, expectedAsset } = params;

  try {
    // 1. Deserialize
    const { transaction, senderAuthenticator, entryFunction } =
      deserializeAptosPayment(signedTransaction);
    const senderAddress = transaction.rawTransaction.sender.toString();

    // 2. Verify chain ID
    const expectedChainId = getAptosChainId(network);
    const txChainId = Number(transaction.rawTransaction.chain_id.chainId);
    if (txChainId !== expectedChainId) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: `Chain ID mismatch: expected ${expectedChainId}, got ${txChainId}`,
      };
    }

    // 3. Verify sender signature (Ed25519 auth key derivation)
    if (senderAuthenticator.isEd25519()) {
      const pubKey = senderAuthenticator.public_key as Ed25519PublicKey;
      const derivedAddress = AccountAddress.from(pubKey.authKey().derivedAddress());
      if (!derivedAddress.equals(transaction.rawTransaction.sender)) {
        return {
          success: false,
          payer: senderAddress,
          errorMessage: 'Sender/authenticator mismatch',
        };
      }
    }

    // 4. Verify not expired (5-second buffer)
    const EXPIRATION_BUFFER_SECONDS = 5;
    const expirationTimestamp = Number(transaction.rawTransaction.expiration_timestamp_secs);
    if (expirationTimestamp < Math.floor(Date.now() / 1000) + EXPIRATION_BUFFER_SECONDS) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: 'Transaction expired',
      };
    }

    // 5. Verify entry function is a supported transfer
    if (!entryFunction) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: 'Missing entry function in transaction',
      };
    }

    const moduleAddress = entryFunction.module_name.address;
    const moduleName = entryFunction.module_name.name.identifier;
    const functionName = entryFunction.function_name.identifier;

    const isPrimaryFungibleStore =
      AccountAddress.ONE.equals(moduleAddress) &&
      moduleName === 'primary_fungible_store' &&
      functionName === 'transfer';

    const isFungibleAsset =
      AccountAddress.ONE.equals(moduleAddress) &&
      moduleName === 'fungible_asset' &&
      functionName === 'transfer';

    if (!isPrimaryFungibleStore && !isFungibleAsset) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: `Unsupported function: ${moduleName}::${functionName}`,
      };
    }

    // 6. Verify asset, amount, recipient if expected values provided
    const args = entryFunction.args;
    if (args.length !== 3) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: `Expected 3 function arguments, got ${args.length}`,
      };
    }

    const [faAddressArg, recipientAddressArg, amountArg] = args;

    if (expectedAsset) {
      const faAddress = AccountAddress.from(faAddressArg.bcsToBytes());
      if (!faAddress.equals(AccountAddress.from(expectedAsset))) {
        return {
          success: false,
          payer: senderAddress,
          errorMessage: 'Asset mismatch',
        };
      }
    }

    if (expectedAmount) {
      const amount = new Deserializer(amountArg.bcsToBytes()).deserializeU64().toString(10);
      if (amount !== expectedAmount) {
        return {
          success: false,
          payer: senderAddress,
          errorMessage: `Amount mismatch: expected ${expectedAmount}, got ${amount}`,
        };
      }
    }

    if (expectedRecipient) {
      const recipientAddress = AccountAddress.from(recipientAddressArg.bcsToBytes());
      if (!recipientAddress.equals(AccountAddress.from(expectedRecipient))) {
        return {
          success: false,
          payer: senderAddress,
          errorMessage: 'Recipient mismatch',
        };
      }
    }

    // 7. Create client and check balance
    const rpcUrl = network.includes('testnet') || network === APTOS_TESTNET_CAIP2
      ? process.env.APTOS_TESTNET_RPC_URL
      : process.env.APTOS_RPC_URL;
    const aptos = createAptosClient(network, rpcUrl);

    const assetAddress = AccountAddress.from(faAddressArg.bcsToBytes()).toString();
    const balance = await aptos.getCurrentFungibleAssetBalances({
      options: {
        where: {
          owner_address: { _eq: senderAddress },
          asset_type: { _eq: assetAddress },
        },
      },
    });
    const currentBalance = BigInt(balance[0]?.amount ?? 0);
    const txAmount = new Deserializer(amountArg.bcsToBytes()).deserializeU64();
    if (currentBalance < txAmount) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: `Insufficient balance: has ${currentBalance}, needs ${txAmount}`,
      };
    }

    // 8. Simulate
    let publicKey = undefined;
    if (senderAuthenticator.isEd25519()) {
      publicKey = senderAuthenticator.public_key;
    } else if (senderAuthenticator.isSingleKey()) {
      publicKey = senderAuthenticator.public_key;
    } else if (senderAuthenticator.isMultiKey()) {
      publicKey = senderAuthenticator.public_keys;
    }

    const simulationResult = (
      await aptos.transaction.simulate.simple({ signerPublicKey: publicKey, transaction })
    )[0];

    if (!simulationResult.success) {
      return {
        success: false,
        payer: senderAddress,
        errorMessage: `Simulation failed: ${simulationResult.vm_status}`,
      };
    }

    // 9. Submit (non-sponsored)
    const pendingTxn = await aptos.transaction.submit.simple({
      transaction,
      senderAuthenticator,
    });

    // 10. Wait for confirmation
    await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

    // 11. Return result
    return {
      success: true,
      transactionHash: pendingTxn.hash,
      payer: senderAddress,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errorMessage: `Aptos settlement failed: ${errorMessage}`,
    };
  }
}
