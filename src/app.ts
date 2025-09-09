import express from "express";
import cors from "cors";
import morgan from "morgan";
import invoiceRoutes from "./routes/invoiceRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import payrollRoutes from "./routes/payrollRoutes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/invoices", invoiceRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/payrolls", payrollRoutes);

export default app;
