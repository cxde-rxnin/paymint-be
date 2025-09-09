import { Request, Response } from "express";
import Payroll from "../models/Payroll";
import { createOnChainPayroll, payOnChainPayroll } from "../services/suiService";
import { sendPayrollEmail } from "../utils/email";

// Create payroll with multiple recipients
export const createPayroll = async (req: Request, res: Response) => {
  try {
    const { 
      issuer, 
      clientEmail, 
      recipients, 
      surchargeBps, 
      metadataHash, 
      dueDate, 
      projectName, 
      description 
    } = req.body;

    // Validate recipients
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: "Recipients array is required and cannot be empty" });
    }

    // Calculate total amount
    const totalAmount = recipients.reduce((sum: number, recipient: any) => sum + recipient.amount, 0);

    const createdAt = Date.now();

    // On-chain creation
    const { txDigest, objectId } = await createOnChainPayroll({
      issuer,
      clientEmail,
      recipients: recipients.map((r: any) => ({ wallet: r.wallet, amount: parseInt(r.amount) })),
      totalAmount,
      surchargeBps: parseInt(surchargeBps),
      metadataHash,
      dueDate: parseInt(dueDate),
      createdAt,
    });

    const payroll = await Payroll.create({
      issuer,
      clientEmail,
      recipients: recipients.map((r: any) => ({ wallet: r.wallet, amount: parseInt(r.amount) })),
      totalAmount,
      surchargeBps,
      metadataHash,
      dueDate,
      createdAt,
      projectName,
      description,
      txDigest,
      objectId,
      status: "unpaid",
    });

    // Send email notification to the client
    try {
      const baseTotalAmount = totalAmount / 1_000_000_000; // Convert MIST to SUI for display
      const surchargeAmount = (baseTotalAmount * surchargeBps) / 10000;
      const finalTotalAmount = baseTotalAmount + surchargeAmount;
      
      // Create payment URL
      const paymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay-payroll/${payroll._id}`;
      
      await sendPayrollEmail(clientEmail, {
        projectName,
        description,
        recipients: recipients.map((r: any) => ({
          wallet: r.wallet,
          amount: r.amount / 1_000_000_000, // Convert to SUI for display
        })),
        totalAmount: baseTotalAmount,
        surchargeAmount,
        finalTotalAmount,
        dueDate: new Date(parseInt(dueDate) * 1000).toLocaleDateString(),
        paymentUrl,
        teamLeadName: "Paymint User", // You might want to get this from user profile
      });
      
      console.log(`Payroll email sent to ${clientEmail}`);
    } catch (emailError) {
      console.error("Error sending payroll email:", emailError);
      // Don't fail the entire request if email fails
    }

    res.json(payroll);
  } catch (error) {
    console.error("Error creating payroll:", error);
    res.status(500).json({ 
      message: "Error creating payroll", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

// Pay payroll with wallet address
export const payPayroll = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    if (payroll.status === "paid") {
      return res.status(400).json({ message: "Payroll already paid" });
    }

    const txDigest = await payOnChainPayroll({
      payrollId: payroll.objectId,
      payer: walletAddress,
      recipients: payroll.recipients,
      totalAmount: payroll.totalAmount,
      surchargeBps: payroll.surchargeBps,
    });

    payroll.status = "paid";
    payroll.paymentTx = txDigest;
    payroll.paidAt = new Date();
    await payroll.save();

    res.json(payroll);
  } catch (error) {
    console.error("Error paying payroll:", error);
    res.status(500).json({ 
      message: "Error paying payroll", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

// Get all payrolls
export const getAllPayrolls = async (req: Request, res: Response) => {
  try {
    const { issuer } = req.query;
    
    const filter = issuer ? { issuer } : {};
    const payrolls = await Payroll.find(filter).sort({ createdAt: -1 });
    res.json(payrolls);
  } catch (error) {
    console.error("Error fetching payrolls:", error);
    res.status(500).json({ message: "Error fetching payrolls" });
  }
};

// Get single payroll
export const getPayroll = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findById(id);
    
    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found" });
    }
    
    res.json(payroll);
  } catch (error) {
    console.error("Error fetching payroll:", error);
    res.status(500).json({ message: "Error fetching payroll" });
  }
};

// Mark payroll as paid after successful client-side transaction
export const markPayrollPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { txDigest } = req.body;

    if (!txDigest) {
      return res.status(400).json({ error: 'Transaction digest is required' });
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found' });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({ error: 'Payroll already paid' });
    }

    // Update payroll status
    payroll.status = 'paid';
    payroll.paymentTx = txDigest;
    payroll.paidAt = new Date();

    await payroll.save();

    console.log('Payroll marked as paid:', payroll._id, 'Transaction:', txDigest);

    res.json({ success: true, payroll });
    
    // Emit real-time update to the issuer's room
    if (global.io && payroll.issuer) {
      global.io.to(`wallet:${payroll.issuer}`).emit('payroll-paid', {
        payrollId: payroll._id,
        payroll: payroll,
        message: 'Payroll payment confirmed'
      });
    }
  } catch (error) {
    console.error('Error marking payroll as paid:', error);
    res.status(500).json({ error: 'Failed to update payroll status' });
  }
};

// Get payrolls by client email (for client to see their payrolls to pay)
export const getPayrollsByClient = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const payrolls = await Payroll.find({ clientEmail: email }).sort({ createdAt: -1 });
    res.json(payrolls);
  } catch (error) {
    console.error("Error fetching payrolls by client:", error);
    res.status(500).json({ message: "Error fetching payrolls" });
  }
};
