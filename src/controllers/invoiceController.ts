import { Request, Response } from "express";
import Invoice from "../models/Invoice";
import { createOnChainInvoice, payOnChainInvoice } from "../services/suiService";
import { sendInvoiceEmail } from "../utils/email";

// Create invoice with client email
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { payeeId, payer, clientId, amount, surchargeBps, metadataHash, dueDate, service, description } = req.body;

    const createdAt = Date.now();

    // On-chain creation with payeeId
    const { txDigest, objectId } = await createOnChainInvoice({
      payeeId,
      amount: parseInt(amount),
      surchargeBps: parseInt(surchargeBps),
      metadataHash,
      dueDate: parseInt(dueDate),
      createdAt,
    });

    const invoice = await Invoice.create({
      payeeId,
      payer, // email
      clientId,
      amount: parseInt(amount), // Store amount in MIST
      surchargeBps,
      metadataHash,
      dueDate,
      createdAt,
      service,
      description,
      txDigest,
      objectId,
      status: "unpaid",
    });

    // Send email notification to the payer
    try {
      const baseAmount = parseInt(amount) / 1_000_000_000; // Convert MIST back to SUI for display
      const surchargeAmount = (baseAmount * surchargeBps) / 10000;
      const totalAmount = baseAmount + surchargeAmount;
      
      // Create payment URL (you might want to customize this based on your frontend URL)
      const paymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay/${invoice._id}`;
      
      await sendInvoiceEmail(payer, {
        invoiceNumber: clientId.toString(),
        service,
        description,
        amount: baseAmount,
        surchargeAmount,
        totalAmount,
        dueDate: new Date(parseInt(dueDate) * 1000).toLocaleDateString(),
        paymentUrl,
        payeeName: "Paymint User" // You might want to get this from user profile
      });
      
      console.log(`Invoice email sent to ${payer}`);
    } catch (emailError) {
      console.error("Error sending invoice email:", emailError);
      // Don't fail the entire request if email fails
    }

    res.json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ 
      message: "Error creating invoice", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

// Pay invoice with wallet address
export const payInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Invoice already paid" });
    }

    const txDigest = await payOnChainInvoice({
      invoiceId: invoice.objectId,
      payer: walletAddress, // wallet pays
      amount: invoice.amount,
      surchargeBps: invoice.surchargeBps,
    });

    invoice.status = "paid";
    invoice.paymentTx = txDigest;
    invoice.clientId = walletAddress; // set client wallet on payment
    await invoice.save();

    res.json(invoice);
  } catch (error) {
    console.error("Error paying invoice:", error);
    res.status(500).json({ 
      message: "Error paying invoice", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

// Get all invoices
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Error fetching invoices" });
  }
};

// Get single invoice
export const getInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ message: "Error fetching invoice" });
  }
};
