import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface InvoiceEmailData {
  invoiceNumber: string;
  service: string;
  description?: string;
  amount: number; // in SUI
  surchargeAmount: number; // in SUI
  totalAmount: number; // in SUI
  dueDate: string;
  paymentUrl: string;
  payeeName?: string;
}

export const createInvoiceEmailTemplate = (data: InvoiceEmailData): string => {
  const {
    invoiceNumber,
    service,
    description,
    amount,
    surchargeAmount,
    totalAmount,
    dueDate,
    paymentUrl,
    payeeName = "Paymint User"
  } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceNumber}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .email-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 40px 30px;
        }
        .invoice-details {
            background: #f8fafc;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
            border-left: 4px solid #10b981;
        }
        .invoice-number {
            font-size: 18px;
            font-weight: 600;
            color: #10b981;
            margin-bottom: 16px;
        }
        .service-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
        }
        .service-description {
            color: #6b7280;
            margin-bottom: 20px;
            font-size: 15px;
        }
        .amount-breakdown {
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
        }
        .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 15px;
        }
        .amount-row.total {
            font-weight: 600;
            font-size: 18px;
            color: #1f2937;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
            margin-top: 12px;
        }
        .amount-value {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
        }
        .pay-button {
            display: inline-block;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 24px 0;
            text-align: center;
            box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.3);
            transition: all 0.3s ease;
        }
        .pay-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px 0 rgba(16, 185, 129, 0.4);
        }
        .due-date {
            color: #dc2626;
            font-weight: 500;
            margin-top: 16px;
        }
        .footer {
            background: #f9fafb;
            padding: 24px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .footer p {
            margin: 4px 0;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .content {
                padding: 24px 20px;
            }
            .header {
                padding: 24px 20px;
            }
            .invoice-details {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>📧 New Invoice</h1>
            <p>You have received a payment request</p>
        </div>
        
        <div class="content">
            <h2>Hello!</h2>
            <p>You have received an invoice from <strong>${payeeName}</strong>. Please review the details below and proceed with payment.</p>
            
            <div class="invoice-details">
                <div class="invoice-number">Invoice #${invoiceNumber}</div>
                
                <div class="service-title">${service}</div>
                ${description ? `<div class="service-description">${description}</div>` : ''}
                
                <div class="amount-breakdown">
                    <div class="amount-row">
                        <span>Service Amount:</span>
                        <span class="amount-value">${amount.toFixed(4)} SUI</span>
                    </div>
                    <div class="amount-row">
                        <span>Network Fee (2.5%):</span>
                        <span class="amount-value">+${surchargeAmount.toFixed(4)} SUI</span>
                    </div>
                    <div class="amount-row total">
                        <span>Total Amount:</span>
                        <span class="amount-value">${totalAmount.toFixed(4)} SUI</span>
                    </div>
                </div>
                
                <div class="due-date">
                    📅 Due Date: ${dueDate}
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${paymentUrl}" class="pay-button">
                    💳 Pay Invoice
                </a>
            </div>
            
            <p><strong>Payment Instructions:</strong></p>
            <ul>
                <li>Click the "Pay Invoice" button above</li>
                <li>Connect your SUI wallet</li>
                <li>Confirm the payment transaction</li>
                <li>You'll receive a confirmation once payment is complete</li>
            </ul>
            
            <p>If you have any questions about this invoice, please contact the sender directly.</p>
        </div>
        
        <div class="footer">
            <p><strong>Paymint</strong> - Blockchain Invoice Platform</p>
            <p>This email was sent automatically. Please do not reply to this email.</p>
            <p>Powered by SUI blockchain technology</p>
        </div>
    </div>
</body>
</html>
  `;
};

export const sendInvoiceEmail = async (
  to: string,
  invoiceData: InvoiceEmailData
) => {
  const htmlContent = createInvoiceEmailTemplate(invoiceData);
  
  await transporter.sendMail({
    from: '"Paymint" <noreply@paymint.com>',
    to,
    subject: `Invoice #${invoiceData.invoiceNumber} - Payment Required`,
    html: htmlContent,
    text: `
Invoice #${invoiceData.invoiceNumber}

Service: ${invoiceData.service}
${invoiceData.description ? `Description: ${invoiceData.description}` : ''}

Amount Breakdown:
- Service Amount: ${invoiceData.amount.toFixed(4)} SUI
- Network Fee (2.5%): +${invoiceData.surchargeAmount.toFixed(4)} SUI
- Total Amount: ${invoiceData.totalAmount.toFixed(4)} SUI

Due Date: ${invoiceData.dueDate}

Pay this invoice: ${invoiceData.paymentUrl}

Questions? Contact the sender directly.

Paymint - Blockchain Invoice Platform
    `.trim(),
  });
};

// Keep the old function for backward compatibility
export const sendInvoiceReminder = async (to: string, subject: string, text: string) => {
  await transporter.sendMail({
    from: '"Paymint" <noreply@paymint.com>',
    to,
    subject,
    text,
  });
};

interface PaymentConfirmationData {
  invoiceNumber: string;
  service: string;
  description?: string;
  amount: number; // in SUI
  surchargeAmount: number; // in SUI
  totalAmount: number; // in SUI
  paidAmount: number; // in SUI
  txDigest: string;
  payeeName?: string;
  paidDate: string;
}

export const createPaymentConfirmationTemplate = (data: PaymentConfirmationData): string => {
  const {
    invoiceNumber,
    service,
    description,
    amount,
    surchargeAmount,
    totalAmount,
    paidAmount,
    txDigest,
    payeeName = "Paymint User",
    paidDate
  } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation - Invoice ${invoiceNumber}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .success-badge {
            background: #d1fae5;
            color: #065f46;
            padding: 12px 20px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 30px;
            font-weight: 600;
        }
        .invoice-details {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
            border-bottom: none;
            font-weight: 600;
            font-size: 18px;
            color: #059669;
        }
        .detail-label {
            color: #6b7280;
        }
        .detail-value {
            font-weight: 500;
            color: #111827;
        }
        .transaction-info {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        .transaction-info h3 {
            margin: 0 0 15px 0;
            color: #1e40af;
            font-size: 16px;
        }
        .tx-hash {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            background: #dbeafe;
            padding: 8px 12px;
            border-radius: 6px;
            word-break: break-all;
            color: #1e40af;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background: #f9fafb;
            color: #6b7280;
            font-size: 14px;
        }
        .cta-button {
            display: inline-block;
            background: #059669;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Payment Received</h1>
            <p>Thank you for your payment!</p>
        </div>
        
        <div class="content">
            <div class="success-badge">
                🎉 Your payment has been successfully processed and confirmed on the blockchain
            </div>
            
            <p>Dear Valued Client,</p>
            
            <p>We're pleased to confirm that your payment for <strong>${service}</strong> has been successfully received and processed.</p>
            
            <div class="invoice-details">
                <h3 style="margin: 0 0 15px 0; color: #111827;">Payment Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Invoice Number:</span>
                    <span class="detail-value">#${invoiceNumber}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span class="detail-value">${service}</span>
                </div>
                ${description ? `
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${description}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Service Amount:</span>
                    <span class="detail-value">${amount.toFixed(4)} SUI</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Processing Fee:</span>
                    <span class="detail-value">${surchargeAmount.toFixed(4)} SUI</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Paid:</span>
                    <span class="detail-value">${paidAmount.toFixed(4)} SUI</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Date:</span>
                    <span class="detail-value">${paidDate}</span>
                </div>
            </div>
            
            <div class="transaction-info">
                <h3>🔗 Blockchain Transaction Details</h3>
                <p style="margin: 0 0 10px 0; color: #374151;">Your payment has been permanently recorded on the Sui blockchain.</p>
                <p style="margin: 0 0 5px 0; font-weight: 600; color: #1e40af;">Transaction Hash:</p>
                <div class="tx-hash">${txDigest}</div>
            </div>
            
            <p>Your payment has been securely processed on the Sui blockchain, ensuring transparency and immutability. The service provider has been notified and will proceed with delivering the requested service.</p>
            
            <p>If you have any questions about this payment or need assistance, please don't hesitate to contact our support team.</p>
            
            <p>Thank you for choosing Paymint for your payment needs!</p>
            
            <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>The Paymint Team</strong>
            </p>
        </div>
        
        <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this message.</p>
            <p>© 2025 Paymint. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `.trim();
};

export const sendPaymentConfirmationEmail = async (
  to: string,
  data: PaymentConfirmationData
) => {
  const subject = `Payment Confirmed - Invoice #${data.invoiceNumber}`;
  const html = createPaymentConfirmationTemplate(data);

  await transporter.sendMail({
    from: '"Paymint" <noreply@paymint.com>',
    to,
    subject,
    html,
  });
};
