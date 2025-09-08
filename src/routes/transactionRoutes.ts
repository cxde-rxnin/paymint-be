import { Router } from "express";
import Invoice from "../models/Invoice";

const router = Router();

/**
 * Get transactions (paid invoices) for dashboard
 */
router.get('/', async (req, res) => {
  try {
    const { payeeId } = req.query;
    
    // Build query filter
    const filter: any = { status: "paid" };
    if (payeeId) {
      filter.payeeId = payeeId;
    }

    // Get paid invoices ordered by payment date
    const paidInvoices = await Invoice.find(filter)
      .sort({ paidAt: -1, createdAt: -1 }) // Sort by payment date, then creation timestamp
      .limit(50); // Limit to last 50 transactions

    // Transform invoices to transaction format
    const transactions = paidInvoices.map(invoice => {
      const totalAmount = invoice.amount + Math.floor((invoice.amount * invoice.surchargeBps) / 10000);
      
      // Get the best available date
      const transactionDate = invoice.paidAt || 
                            new Date(invoice.createdAt * 1000) || // Convert Unix timestamp to Date
                            new Date();
      
      return {
        id: invoice._id?.toString() || '',
        invoiceNumber: invoice.clientId || invoice._id?.toString() || '',
        service: invoice.service,
        description: invoice.description,
        amount: totalAmount / 1_000_000_000, // Convert MIST to SUI
        baseAmount: invoice.amount / 1_000_000_000,
        surchargeAmount: Math.floor((invoice.amount * invoice.surchargeBps) / 10000) / 1_000_000_000,
        date: transactionDate,
        status: "completed",
        txDigest: invoice.txDigest,
        payer: invoice.payer,
        payeeId: invoice.payeeId
      };
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
