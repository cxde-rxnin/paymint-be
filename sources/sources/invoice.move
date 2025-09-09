module sources::invoice {
    use sui::coin::Coin;
    use sui::event;

    const E_INVOICE_ALREADY_PAID: u64 = 1;
    const E_INSUFFICIENT_PAYMENT: u64 = 2;
    const E_PAYROLL_ALREADY_PAID: u64 = 3;
    const E_RECIPIENTS_AMOUNTS_MISMATCH: u64 = 4;
    const E_EMPTY_RECIPIENTS: u64 = 5;

    /// Event emitted when an invoice is created
    public struct InvoiceCreatedEvent has copy, drop, store {
        invoice_id: address,
        issuer: address,
        payee: address,
        amount: u64,
        surcharge_bps: u64,
    }

    /// Event emitted when an invoice is paid
    public struct InvoicePaidEvent has copy, drop, store {
        invoice_id: address,
        payer: address,
        amount: u64,
        surcharge: u64,
        platform_recipient: address,
        issuer_recipient: address,
    }

    /// Event emitted when a payroll is created
    public struct PayrollCreatedEvent has copy, drop, store {
        payroll_id: address,
        issuer: address,
        client_email: vector<u8>,
        recipients: vector<address>,
        amounts: vector<u64>,
        total_amount: u64,
        surcharge_bps: u64,
    }

    /// Event emitted when a payroll is paid
    public struct PayrollPaidEvent has copy, drop, store {
        payroll_id: address,
        payer: address,
        total_amount: u64,
        surcharge: u64,
        platform_recipient: address,
        recipients: vector<address>,
        amounts: vector<u64>,
    }

    /// Invoice object stored on-chain
    public struct Invoice has key, store {
        id: sui::object::UID,
        issuer: address,
        payee: address,
        amount: u64,
        surcharge_bps: u64,
        metadata_hash: vector<u8>,
        due_date_unix: u64,
        paid: bool,
        created_at_unix: u64,
    }

    /// Payroll object stored on-chain
    public struct Payroll has key, store {
        id: sui::object::UID,
        issuer: address,                // freelancer / team lead
        client_email: vector<u8>,       // who pays (off-chain email reference)
        recipients: vector<address>,    // list of freelancer wallets
        amounts: vector<u64>,           // matching payouts
        total_amount: u64,              // sum of amounts
        surcharge_bps: u64,             // platform fee
        metadata_hash: vector<u8>,      // project details
        due_date_unix: u64,
        paid: bool,
        created_at_unix: u64,
    }

    /// Create an invoice and emit an InvoiceCreatedEvent.
    public fun create_invoice(
        payee_addr: address,
        amount: u64,
        surcharge_bps: u64,
        metadata_hash: vector<u8>,
        due_date_unix: u64,
        created_at_unix: u64,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let issuer_addr = ctx.sender();
        let uid = sui::object::new(ctx);
        let invoice_id = sui::object::uid_to_address(&uid);

        let inv = Invoice {
            id: uid,
            issuer: issuer_addr,
            payee: payee_addr,
            amount,
            surcharge_bps,
            metadata_hash,
            due_date_unix,
            paid: false,
            created_at_unix,
        };

        sui::transfer::share_object(inv);

        let ev = InvoiceCreatedEvent {
            invoice_id,
            issuer: issuer_addr,
            payee: payee_addr,
            amount,
            surcharge_bps,
        };
        event::emit(ev);
    }

    /// Pay an invoice, split payment into issuer amount and platform surcharge, then emit InvoicePaidEvent.
    public fun pay_invoice<CoinType>(
        invoice_obj: &mut Invoice,
        mut payment: Coin<CoinType>,
        platform_recipient: address,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(!invoice_obj.paid, E_INVOICE_ALREADY_PAID);

        let amount = invoice_obj.amount;
        let surcharge_bps = invoice_obj.surcharge_bps;
        let surcharge = (amount * surcharge_bps) / 10000u64;
        let total_due = amount + surcharge;

        let paid_value = payment.value();
        assert!(paid_value >= total_due, E_INSUFFICIENT_PAYMENT);

        let coin_for_issuer = payment.split(amount, ctx);
        let coin_for_platform = payment.split(surcharge, ctx);

        sui::transfer::public_transfer(coin_for_issuer, invoice_obj.payee);
        sui::transfer::public_transfer(coin_for_platform, platform_recipient);

        let remainder = payment.value();
        if (remainder > 0u64) {
            sui::transfer::public_transfer(payment, ctx.sender());
        } else {
            payment.destroy_zero();
        };

        invoice_obj.paid = true;

        let ev = InvoicePaidEvent {
            invoice_id: sui::object::uid_to_address(&invoice_obj.id),
            payer: ctx.sender(),
            amount,
            surcharge,
            platform_recipient,
            issuer_recipient: invoice_obj.payee,
        };
        event::emit(ev);
    }

    /// Return whether an invoice is paid.
    public fun is_paid(inv: &Invoice): bool {
        inv.paid
    }

    /// Get the amount due for an invoice.
    public fun get_amount(inv: &Invoice): u64 {
        inv.amount
    }

    /// Get the total amount due (including surcharge).
    public fun get_total_due(inv: &Invoice): u64 {
        let surcharge = (inv.amount * inv.surcharge_bps) / 10000u64;
        inv.amount + surcharge
    }

    /// Create a payroll with multiple recipients and emit a PayrollCreatedEvent.
    public fun create_payroll(
        client_email: vector<u8>,
        recipients: vector<address>,
        amounts: vector<u64>,
        surcharge_bps: u64,
        metadata_hash: vector<u8>,
        due_date_unix: u64,
        created_at_unix: u64,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(recipients.length() > 0, E_EMPTY_RECIPIENTS);
        assert!(recipients.length() == amounts.length(), E_RECIPIENTS_AMOUNTS_MISMATCH);

        let issuer_addr = ctx.sender();
        let uid = sui::object::new(ctx);
        let payroll_id = sui::object::uid_to_address(&uid);

        // Calculate total amount
        let mut total_amount = 0u64;
        let mut i = 0;
        while (i < amounts.length()) {
            total_amount = total_amount + amounts[i];
            i = i + 1;
        };

        let payroll = Payroll {
            id: uid,
            issuer: issuer_addr,
            client_email,
            recipients,
            amounts,
            total_amount,
            surcharge_bps,
            metadata_hash,
            due_date_unix,
            paid: false,
            created_at_unix,
        };

        sui::transfer::share_object(payroll);

        let ev = PayrollCreatedEvent {
            payroll_id,
            issuer: issuer_addr,
            client_email,
            recipients,
            amounts,
            total_amount,
            surcharge_bps,
        };
        event::emit(ev);
    }

    /// Pay a payroll, splitting payment to all recipients and platform surcharge.
    public fun pay_payroll<CoinType>(
        payroll_obj: &mut Payroll,
        mut payment: Coin<CoinType>,
        platform_recipient: address,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(!payroll_obj.paid, E_PAYROLL_ALREADY_PAID);

        let total_amount = payroll_obj.total_amount;
        let surcharge_bps = payroll_obj.surcharge_bps;
        let surcharge = (total_amount * surcharge_bps) / 10000u64;
        let total_due = total_amount + surcharge;

        let paid_value = payment.value();
        assert!(paid_value >= total_due, E_INSUFFICIENT_PAYMENT);

        // Split payments to all recipients
        let mut i = 0;
        while (i < payroll_obj.recipients.length()) {
            let recipient = payroll_obj.recipients[i];
            let amount = payroll_obj.amounts[i];
            let coin_for_recipient = payment.split(amount, ctx);
            sui::transfer::public_transfer(coin_for_recipient, recipient);
            i = i + 1;
        };

        // Pay platform surcharge
        let coin_for_platform = payment.split(surcharge, ctx);
        sui::transfer::public_transfer(coin_for_platform, platform_recipient);

        // Return any remainder to payer
        let remainder = payment.value();
        if (remainder > 0u64) {
            sui::transfer::public_transfer(payment, ctx.sender());
        } else {
            payment.destroy_zero();
        };

        payroll_obj.paid = true;

        let ev = PayrollPaidEvent {
            payroll_id: sui::object::uid_to_address(&payroll_obj.id),
            payer: ctx.sender(),
            total_amount,
            surcharge,
            platform_recipient,
            recipients: payroll_obj.recipients,
            amounts: payroll_obj.amounts,
        };
        event::emit(ev);
    }

    /// Return whether a payroll is paid.
    public fun is_payroll_paid(payroll: &Payroll): bool {
        payroll.paid
    }

    /// Get the total amount due for a payroll (including surcharge).
    public fun get_payroll_total_due(payroll: &Payroll): u64 {
        let surcharge = (payroll.total_amount * payroll.surcharge_bps) / 10000u64;
        payroll.total_amount + surcharge
    }
}
