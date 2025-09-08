import { Router } from "express";
import { createOnChainInvoice, payOnChainInvoice } from "../services/suiService";
import Invoice from "../models/Invoice";
import { sendInvoiceEmail, sendPaymentConfirmationEmail } from "../utils/email";

const router = Router();

/**
 * Get contract information for frontend
 */
router.get('/contracts/info', async (req, res) => {
  res.json({
    packageId: process.env.SUI_PACKAGE_ID || "0x698244483b583964eafaf294f4865d8080d47a520bbcf207c0b29eed1036f8d4",
    network: process.env.SUI_NETWORK || "testnet",
    platformRecipient: process.env.PLATFORM_RECIPIENT || "0x2222d18c263a17e7362265fa418f7862554df68045011b3c9c54fa54e20c9641"
  });
});

/**
 * Mark invoice as paid after successful client-side transaction
 */
router.post('/:id/mark-paid', async (req, res) => {
  try {
    const { txDigest } = req.body;
    const { id } = req.params;

    if (!txDigest) {
      return res.status(400).json({ error: "Transaction digest required" });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { 
        status: "paid",
        txDigest: txDigest,
        paidAt: new Date()
      },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Send payment confirmation email to client
    try {
      const amountInSui = invoice.amount / 1_000_000_000;
      const surchargeAmountInSui = (amountInSui * invoice.surchargeBps) / 10000;
      const totalAmountInSui = amountInSui + surchargeAmountInSui;

      await sendPaymentConfirmationEmail(invoice.payer, {
        invoiceNumber: invoice.clientId || (invoice._id as string).toString(),
        service: invoice.service,
        description: invoice.description,
        amount: amountInSui,
        surchargeAmount: surchargeAmountInSui,
        totalAmount: totalAmountInSui,
        paidAmount: totalAmountInSui,
        txDigest: txDigest,
        paidDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      console.log('Payment confirmation email sent to:', invoice.payer);
    } catch (emailError) {
      console.error('Failed to send payment confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ success: true, invoice });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

/**
 * Pay an invoice (auto-selects payer's coins) - DEPRECATED: Use client-side signing instead
 */
router.post("/pay/:id", async (req, res) => {
  try {
    const { payer } = req.body;
    const { id } = req.params;

    // Validate payer address
    if (!payer || typeof payer !== 'string' || payer.trim().length === 0) {
      return res.status(400).json({ error: "Invalid payer address provided" });
    }

    // Basic Sui address validation (should start with 0x and be 66 chars)
    const cleanPayer = payer.trim();
    if (!cleanPayer.startsWith('0x') || cleanPayer.length !== 66) {
      return res.status(400).json({ error: "Invalid Sui address format" });
    }

    console.log('Payment request for invoice:', id, 'from payer:', cleanPayer);

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ error: "Invoice already paid" });
    }

    const txDigest = await payOnChainInvoice({
      invoiceId: invoice.objectId, // use objectId
      payer: cleanPayer,
      amount: invoice.amount,
      surchargeBps: invoice.surchargeBps,
    });

    invoice.status = "paid";
    invoice.txDigest = txDigest;
    await invoice.save();

    res.json({ success: true, txDigest });
  } catch (error: any) {
    console.error('Payment error:', error);
    res.status(500).json({ error: error.message || 'Payment failed' });
  }
});

/**
 * Create a new invoice (on-chain + DB)
 */
router.post("/create", async (req, res) => {
  try {
    const { payeeId, clientId, payer, amount, surchargeBps, metadataHash, dueDate, service, description } = req.body;

    const createdAt = Date.now();

    const { txDigest, objectId } = await createOnChainInvoice({
      payeeId,
      payer,
      clientId,
      amount,
      surchargeBps,
      metadataHash,
      dueDate,
      createdAt,
    });

    const invoice = new Invoice({
      payeeId,
      clientId,
      payer,
      amount,
      surchargeBps,
      metadataHash,
      dueDate,
      createdAt,
      service,
      description,
      txDigest,
      objectId, // store the Invoice objectId
      status: "unpaid",
    });

    await invoice.save();

    // Send HTML email notification to the payer
    try {
      const baseAmount = amount / 1_000_000_000; // Convert MIST back to SUI for display
      const surchargeAmount = (baseAmount * surchargeBps) / 10000;
      const totalAmount = baseAmount + surchargeAmount;
      
      // Create payment URL using MongoDB ID (not objectId)
      const paymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay/${invoice._id}`;
      
      await sendInvoiceEmail(payer, {
        invoiceNumber: clientId.toString(),
        service,
        description,
        amount: baseAmount,
        surchargeAmount,
        totalAmount,
        dueDate: new Date(dueDate * 1000).toLocaleDateString(),
        paymentUrl,
        payeeName: "Paymint User" // You might want to get this from user profile
      });
      
      console.log(`Invoice email sent successfully to ${payer} with payment URL: ${paymentUrl}`);
    } catch (emailError) {
      console.error("Failed to send invoice email:", emailError);
      // Don't fail the whole request if email fails
    }

    res.json({ success: true, invoice });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Pay an invoice (auto-selects payer’s coins)
 */
router.post("/pay/:id", async (req, res) => {
  try {
    const { payer } = req.body;
    const { id } = req.params;

    // Validate payer address
    if (!payer || typeof payer !== 'string' || payer.trim().length === 0) {
      return res.status(400).json({ error: "Invalid payer address provided" });
    }

    // Basic Sui address validation (should start with 0x and be 66 chars)
    const cleanPayer = payer.trim();
    if (!cleanPayer.startsWith('0x') || cleanPayer.length !== 66) {
      return res.status(400).json({ error: "Invalid Sui address format" });
    }

    console.log('Payment request for invoice:', id, 'from payer:', cleanPayer);

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ error: "Invoice already paid" });
    }

    const txDigest = await payOnChainInvoice({
      invoiceId: invoice.objectId, // use objectId
      payer: cleanPayer,
      amount: invoice.amount,
      surchargeBps: invoice.surchargeBps,
    });

    invoice.status = "paid";
    invoice.paymentTx = txDigest;
    await invoice.save();

    res.json({ success: true, txDigest, invoice });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all invoices, optionally filtered by payeeId
 */
router.get("/", async (req, res) => {
  try {
    const { payeeId } = req.query;
    
    // Build filter object
    const filter: any = {};
    if (payeeId) {
      filter.payeeId = payeeId;
    }
    
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a single invoice by MongoDB ID (for payment page)
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    res.json(invoice);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a single invoice by object ID (for blockchain operations)
 */
router.get("/object/:objectId", async (req, res) => {
  try {
    const { objectId } = req.params;
    const invoice = await Invoice.findOne({ objectId });
    
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    res.json(invoice);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
