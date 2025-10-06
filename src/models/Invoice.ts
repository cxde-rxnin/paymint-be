import { Schema, model, Document } from "mongoose";

export interface IInvoice extends Document {
  issuer?: string;
  payeeId: string; // Freelancer/Service provider's wallet (who receives payment)
  payer: string;   // Client's email
  clientId?: string; // Client's wallet, filled at payment
  amount: number;
  surchargeBps: number;
  metadataHash: string;
  dueDate: number;
  createdAt: number;
  status: "unpaid" | "paid" | "overdue";
  service: string; // Service description
  description?: string; // Detailed description
  txDigest?: string;
  objectId?: string;
  paymentTx?: string;
  paidAt?: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    issuer: { type: String }, // Freelancer's wallet (deprecated - use payeeId)
    payeeId: { type: String, required: true }, // Freelancer/Service provider's wallet (who receives payment)
    payer: { type: String, required: true }, // Client's email
    clientId: { type: String }, // Wallet address, added when client pays
    amount: { type: Number, required: true },
    surchargeBps: { type: Number, required: true },
    metadataHash: { type: String, required: true },
    dueDate: { type: Number, required: true }, // Unix timestamp
    createdAt: { type: Number, required: true }, // Unix timestamp
    service: { type: String, required: true }, // Service description
    description: { type: String }, // Detailed description
    status: {
      type: String,
      enum: ["unpaid", "paid", "overdue"],
      default: "unpaid",
    },
    txDigest: { type: String },
    objectId: { type: String },
    paymentTx: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

InvoiceSchema.index({ payer: 1 });
InvoiceSchema.index({ payeeId: 1 });
InvoiceSchema.index({ clientId: 1 });
InvoiceSchema.index({ status: 1 });

export default model<IInvoice>("Invoice", InvoiceSchema);
