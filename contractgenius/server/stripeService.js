/**
 * STRIPE PAYMENT SERVICE
 * Generates Stripe Checkout Sessions for deposit or full balance payments.
 * Requires STRIPE_SECRET_KEY in your .env file.
 */

const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Creates a Stripe Checkout Session for a signed contract
 * @param {Object} contract - The full contract object
 * @param {string} paymentType - 'deposit' or 'full'
 * @returns {Promise<string>} - The Stripe Checkout Session URL to redirect the vendor to
 */
async function createPaymentSession(contract, paymentType = 'full') {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('[StripeService] STRIPE_SECRET_KEY is not set. Skipping payment session.');
        return null;
    }

    const vendor = contract.vendorDetails || contract.vendor;
    const totalAmount = vendor.totalAmount || 0;
    const depositAmount = vendor.depositAmount || 0;

    // Determine what amount to charge
    const amountToCharge = paymentType === 'deposit' ? depositAmount : totalAmount;

    if (amountToCharge <= 0) {
        console.warn('[StripeService] Amount is 0 or negative. Skipping payment session.');
        return null;
    }

    // Convert to cents (Stripe works in lowest currency unit)
    const amountInCents = Math.round(amountToCharge * 100);

    const successUrl = process.env.FRONTEND_URL || 'https://contractsigining-9kgu.vercel.app';
    const cancelUrl = process.env.FRONTEND_URL || 'https://contractsigining-9kgu.vercel.app';

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'us_bank_account'], // Card + ACH
            mode: 'payment',
            customer_email: vendor.contacts?.[0]?.email || vendor.email,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `CABANA Exhibition - ${paymentType === 'deposit' ? 'Deposit' : 'Full Balance'}`,
                            description: `Contract ${contract.id} | ${vendor.company || vendor.name} | Booth: ${vendor.finalBoothSize || vendor.boothSize}`,
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                contractId: contract.id,
                paymentType: paymentType,
                company: vendor.company || '',
            },
            success_url: `${successUrl}/#/payment-success?contractId=${contract.id}`,
            cancel_url: `${cancelUrl}/#/contract/${contract.id}`,
        });

        console.log(`[StripeService] ✅ Payment session created: ${session.id} for contract ${contract.id}`);
        return session.url;
    } catch (error) {
        console.error('[StripeService] ❌ Failed to create payment session:', error.message);
        throw error;
    }
}

/**
 * Handles incoming Stripe webhook events (e.g., payment_intent.succeeded)
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe webhook signature header
 */
function handleStripeWebhook(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn('[StripeService] STRIPE_WEBHOOK_SECRET not set, skipping verification.');
        return JSON.parse(payload);
    }
    if (!stripe) {
        return JSON.parse(payload);
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

module.exports = { createPaymentSession, handleStripeWebhook };
