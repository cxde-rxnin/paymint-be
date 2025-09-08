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
        id: invoice.txDigest || invoice._id?.toString() || '', // Use txDigest as transaction ID
        invoiceNumber: invoice.clientId || invoice._id?.toString() || '',
        service: invoice.service,
        description: invoice.description,
        amount: totalAmount, // Keep in MIST for frontend conversion
        baseAmount: invoice.amount, // Keep in MIST
        surchargeAmount: Math.floor((invoice.amount * invoice.surchargeBps) / 10000), // Keep in MIST
        date: transactionDate,
        status: "Success", // Match expected status format
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
