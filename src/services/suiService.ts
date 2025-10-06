import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { bcs } from "@mysten/sui.js/bcs";

// Validate required environment variables
if (!process.env.SUI_SECRET_KEY) {
  throw new Error("SUI_SECRET_KEY environment variable is required");
}

if (!process.env.SUI_PACKAGE_ID) {
  throw new Error("SUI_PACKAGE_ID environment variable is required");
}

const keypair = Ed25519Keypair.fromSecretKey(
  Uint8Array.from(Buffer.from(process.env.SUI_SECRET_KEY, "hex"))
);

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

const PACKAGE_ID = process.env.SUI_PACKAGE_ID;

/**
 * Create a new on-chain invoice
 * Note: No wallet address or clientId at creation (only metadata + amounts).
 */
export const createOnChainInvoice = async (data: any) => {
  const { payeeId, amount, surchargeBps, metadataHash, dueDate, createdAt } = data;

  console.log("Creating invoice with data:", { payeeId, amount, surchargeBps, metadataHash, dueDate, createdAt });

  const tx = new TransactionBlock();

  // Convert metadata hash to proper format
  const metadataBytes = Array.from(Buffer.from(metadataHash, "hex"));
  
  console.log("Metadata bytes length:", metadataBytes.length);
  console.log("Target function:", `${PACKAGE_ID}::invoice::create_invoice`);

  // Use the moveCall with proper argument construction
  console.log("Arguments being passed:", {
    amount: amount,
    surchargeBps: surchargeBps,
    metadataBytes: metadataBytes,
    dueDate: dueDate,
    createdAt: createdAt
  });

  console.log("Calling with 6 arguments to match Move contract signature...");
  
  const moveCallResult = tx.moveCall({
    target: `${PACKAGE_ID}::invoice::create_invoice`,
    arguments: [
      tx.pure(payeeId, "address"),      
      tx.pure(amount, "u64"),        
      tx.pure(surchargeBps, "u64"),          
      tx.pure(metadataBytes, "vector<u8>"),
      tx.pure(dueDate, "u64"),             
      tx.pure(createdAt, "u64"),             
      // ctx is automatically provided by the system
    ],
  });

  console.log("Move call result:", moveCallResult);

  try {
    console.log("Executing transaction...");
    const response = await client.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: keypair,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
    });

    console.log("Transaction response:", response);

    const createdObj = response.objectChanges?.find(
      (o: any) => o.type === "created" && o.objectType?.includes("::invoice::Invoice")
    );

    if (!createdObj || !("objectId" in createdObj)) {
      throw new Error("Invoice object not found in transaction result.");
    }

    return {
      txDigest: response.digest,
      objectId: (createdObj as any).objectId,
    };
  } catch (error) {
    console.error("Error creating on-chain invoice:", error);
    throw error;
  }
};

/**
 * Pay an on-chain invoice (wallet covers payment).
 */
export const payOnChainInvoice = async (data: any) => {
  const { invoiceId, payer, amount, surchargeBps } = data;

  const totalDue = amount + Math.floor((amount * surchargeBps) / 10000);

  const coins = await client.getCoins({
    owner: payer,
    coinType: "0x2::sui::SUI",
  });

  if (!coins.data.length) {
    throw new Error("No SUI coins found in payer account.");
  }

  let selected: string[] = [];
  let accumulated = 0n;

  for (const coin of coins.data) {
    selected.push(coin.coinObjectId);
    accumulated += BigInt(coin.balance);
    if (accumulated >= BigInt(totalDue)) break;
  }

  if (accumulated < BigInt(totalDue)) {
    throw new Error("Insufficient balance to cover invoice.");
  }

  const tx = new TransactionBlock();

  let paymentCoin;
  if (selected.length > 1) {
    paymentCoin = tx.mergeCoins(
      tx.object(selected[0]),
      selected.slice(1).map((id) => tx.object(id))
    );
  } else {
    paymentCoin = tx.object(selected[0]);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::invoice::pay_invoice`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.object(invoiceId),
      paymentCoin,
      tx.pure.address(process.env.PLATFORM_RECIPIENT!),
    ],
  });

  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  return result.digest;
};

/**
 * Create a new on-chain payroll
 */
export const createOnChainPayroll = async (data: any) => {
  const { issuer, clientEmail, recipients, totalAmount, surchargeBps, metadataHash, dueDate, createdAt } = data;

  console.log("Creating payroll with data:", { issuer, clientEmail, recipients, totalAmount, surchargeBps, metadataHash, dueDate, createdAt });

  const tx = new TransactionBlock();

  // Convert metadata hash to proper format
  const metadataBytes = Array.from(Buffer.from(metadataHash, "hex"));
  
  // Convert client email to bytes
  const clientEmailBytes = Array.from(Buffer.from(clientEmail, "utf8"));
  
  // Extract recipient addresses and amounts
  const recipientAddresses = recipients.map((r: any) => r.wallet);
  const recipientAmounts = recipients.map((r: any) => r.amount);

  console.log("Payroll arguments being passed:", {
    clientEmailBytes: clientEmailBytes,
    recipientAddresses: recipientAddresses,
    recipientAmounts: recipientAmounts,
    totalAmount: totalAmount,
    surchargeBps: surchargeBps,
    metadataBytes: metadataBytes,
    dueDate: dueDate,
    createdAt: createdAt
  });

  // Match the Move contract signature: create_payroll(client_email, recipients, amounts, surcharge_bps, metadata_hash, due_date_unix, created_at_unix, ctx)
  const moveCallResult = tx.moveCall({
    target: `${PACKAGE_ID}::invoice::create_payroll`,
    arguments: [
      tx.pure(clientEmailBytes, "vector<u8>"),     
      tx.pure(recipientAddresses, "vector<address>"), 
      tx.pure(recipientAmounts, "vector<u64>"),    
      tx.pure(surchargeBps, "u64"),                   
      tx.pure(metadataBytes, "vector<u8>"),         
      tx.pure(dueDate, "u64"),                      
      tx.pure(createdAt, "u64"),                     
    ],
  });

  console.log("Executing payroll creation transaction...");

  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
    options: { showEffects: true, showObjectChanges: true },
  });

  console.log("Payroll creation result:", result);

  // Extract object ID from created objects
  const createdObjects = result.objectChanges?.filter((change) => change.type === "created") || [];
  const payrollObject = createdObjects.find((obj: any) => obj.objectType?.includes("Payroll"));

  if (!payrollObject || !("objectId" in payrollObject)) {
    throw new Error("Failed to create payroll object on-chain");
  }

  return {
    txDigest: result.digest,
    objectId: payrollObject.objectId,
  };
};

/**
 * Pay an on-chain payroll
 */
export const payOnChainPayroll = async (data: any) => {
  const { payrollId, payer, recipients, totalAmount, surchargeBps } = data;

  console.log("Paying payroll:", { payrollId, payer, recipients, totalAmount, surchargeBps });

  const surcharge = Math.floor((totalAmount * surchargeBps) / 10000);
  const totalDue = totalAmount + surcharge;

  const coins = await client.getCoins({
    owner: payer,
    coinType: "0x2::sui::SUI",
  });

  if (!coins.data.length) {
    throw new Error("No SUI coins found in payer account.");
  }

  let selected: string[] = [];
  let accumulated = 0n;

  for (const coin of coins.data) {
    selected.push(coin.coinObjectId);
    accumulated += BigInt(coin.balance);
    if (accumulated >= BigInt(totalDue)) break;
  }

  if (accumulated < BigInt(totalDue)) {
    throw new Error("Insufficient balance to cover payroll.");
  }

  const tx = new TransactionBlock();

  let paymentCoin;
  if (selected.length > 1) {
    paymentCoin = tx.mergeCoins(
      tx.object(selected[0]),
      selected.slice(1).map((id) => tx.object(id))
    );
  } else {
    paymentCoin = tx.object(selected[0]);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::invoice::pay_payroll`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.object(payrollId),
      paymentCoin,
      tx.pure.address(process.env.PLATFORM_RECIPIENT!),
    ],
  });

  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  return result.digest;
};
