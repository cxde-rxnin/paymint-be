import { Schema, model, Document } from "mongoose";

export interface IPayrollRecipient {
  wallet: string;
  amount: number;
}

export interface IPayroll extends Document {
  issuer: string;                // wallet of team lead
  clientEmail: string;
  recipients: IPayrollRecipient[];
  totalAmount: number;
  surchargeBps: number;
  metadataHash: string;
  dueDate: number;
  createdAt: number;
  status: "unpaid" | "paid" | "overdue";
  txDigest?: string;
  objectId?: string;
  paymentTx?: string;
  projectName: string;
  description?: string;
  paidAt?: Date;
}

const PayrollRecipientSchema = new Schema<IPayrollRecipient>({
  wallet: { type: String, required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const PayrollSchema = new Schema<IPayroll>(
  {
    issuer: { type: String, required: true }, // Team lead's wallet
    clientEmail: { type: String, required: true },
    recipients: { type: [PayrollRecipientSchema], required: true },
    totalAmount: { type: Number, required: true },
    surchargeBps: { type: Number, required: true },
    metadataHash: { type: String, required: true },
    dueDate: { type: Number, required: true },
    createdAt: { type: Number, required: true },
    projectName: { type: String, required: true },
    description: { type: String },
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

PayrollSchema.index({ clientEmail: 1 });
PayrollSchema.index({ issuer: 1 });
PayrollSchema.index({ status: 1 });
PayrollSchema.index({ createdAt: -1 });

export default model<IPayroll>("Payroll", PayrollSchema);
