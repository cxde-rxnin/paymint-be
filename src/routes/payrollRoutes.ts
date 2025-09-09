import { Router } from "express";
import {
  createPayroll,
  payPayroll,
  markPayrollPaid,
  getAllPayrolls,
  getPayroll,
  getPayrollsByClient,
} from "../controllers/payrollController";

const router = Router();

// Create a new payroll
router.post("/", createPayroll);

// Pay a payroll (DEPRECATED - use client-side payment with mark-paid instead)
router.post("/:id/pay", payPayroll);

// Mark payroll as paid after successful client-side transaction
router.post("/:id/mark-paid", markPayrollPaid);

// Get all payrolls (with optional issuer filter)
router.get("/", getAllPayrolls);

// Get payrolls by client email
router.get("/client/:email", getPayrollsByClient);

// Get a single payroll
router.get("/:id", getPayroll);

export default router;
