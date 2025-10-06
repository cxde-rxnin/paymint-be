import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Transaction digest
  amount: { type: Number, required: true }, // Amount in MIST
  date: { type: Date, default: Date.now },
  status: { type: String, required: true, default: "Success" }, // Success, Failed, Pending
  payeeId: { type: String, required: true }, // Wallet address of the payee
  payerId: { type: String, required: true }, // Wallet address of the payer
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }, // Reference to the invoice
  memo: { type: String },
  blockHeight: { type: Number },
  gasUsed: { type: Number },
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for efficient queries
TransactionSchema.index({ payeeId: 1, date: -1 });
TransactionSchema.index({ payerId: 1, date: -1 });
TransactionSchema.index({ id: 1 });

export const Transaction = mongoose.model("Transaction", TransactionSchema);
