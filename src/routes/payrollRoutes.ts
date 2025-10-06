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

router.post("/", createPayroll);

router.post("/:id/pay", payPayroll);

router.post("/:id/mark-paid", markPayrollPaid);

router.get("/", getAllPayrolls);

router.get("/client/:email", getPayrollsByClient);

router.get("/:id", getPayroll);

export default router;
