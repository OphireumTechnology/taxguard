import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { sendTransactionalEmail } from './emails';

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured in Cloud Functions secrets.');
  }
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16' as any
  });
}

// Server-controlled catalog prices (Clients cannot tamper with amounts)
const SERVICE_PLANS_CATALOG: Record<string, { title: string; amountCents: number; interval?: 'month' | 'year' }> = {
  plan_individual_tax: {
    title: 'Individual & Family Wealth Tax Filing',
    amountCents: 45000 // $450.00
  },
  plan_business_growth: {
    title: 'Small Business & Entity Tax Optimization',
    amountCents: 125000 // $1,250.00
  },
  plan_corporate_enterprise: {
    title: 'Corporate & Multi-State Tax Advisory',
    amountCents: 250000 // $2,500.00
  },
  plan_monthly_bookkeeping: {
    title: 'Monthly Bookkeeping & Accounting Advisory',
    amountCents: 35000, // $350.00 / month
    interval: 'month'
  }
};

/**
 * Server-created Stripe Checkout Session
 */
export const createStripeCheckoutSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to initiate checkout.');
  }

  const { planKey, successUrl, cancelUrl } = request.data;
  const catalogItem = SERVICE_PLANS_CATALOG[planKey];

  if (!catalogItem) {
    throw new HttpsError('not-found', `Unknown plan selection: ${planKey}`);
  }

  // Verify Stripe credentials exist
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      status: 'configuration_required',
      message: 'Stripe secret key is not configured in production secrets. Card checkout will be available once STRIPE_SECRET_KEY is supplied.',
      requiresConfig: true
    };
  }

  const stripe = getStripe();
  const callerUid = request.auth.uid;
  const user = await admin.auth().getUser(callerUid);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: catalogItem.interval ? 'subscription' : 'payment',
      customer_email: user.email,
      client_reference_id: callerUid,
      metadata: {
        planKey,
        clientId: callerUid,
        planTitle: catalogItem.title
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: catalogItem.amountCents,
            product_data: {
              name: catalogItem.title,
              description: 'A/R Tax Services, LLC Professional Accounting Services'
            },
            ...(catalogItem.interval ? { recurring: { interval: catalogItem.interval } } : {})
          },
          quantity: 1
        }
      ],
      success_url: successUrl || 'https://artaxserv.com/#/client_portal?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://artaxserv.com/#/pricing'
    });

    return {
      status: 'success',
      sessionId: session.id,
      url: session.url
    };
  } catch (error: any) {
    console.error('Stripe Checkout creation error:', error);
    throw new HttpsError('internal', `Stripe checkout initiation failed: ${error.message}`);
  }
});

/**
 * Stripe Webhook Handler with Idempotency & Signature Verification
 */
export const stripeWebhook = onRequest({ cors: false }, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).send('Stripe signature or webhook secret missing.');
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.rawBody || (req as any).body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const db = admin.firestore();
  const eventRef = db.collection('processedWebhookEvents').doc(event.id);

  // Check idempotency: ignore duplicate webhook events safely
  const eventDoc = await eventRef.get();
  if (eventDoc.exists) {
    console.log(`[Stripe Webhook] Duplicate event ignored: ${event.id}`);
    res.json({ received: true, duplicate: true });
    return;
  }

  // Handle Event Types
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.client_reference_id || session.metadata?.clientId;
      const planTitle = session.metadata?.planTitle || 'Tax Advisory Service';
      const amount = session.amount_total || 0;

      if (clientId) {
        // Create verified payment record
        const paymentId = `pay_${Date.now()}`;
        await db.collection('payments').doc(paymentId).set({
          id: paymentId,
          clientId,
          amountCents: amount,
          currency: 'usd',
          status: 'succeeded',
          stripeChargeId: session.payment_intent as string || session.id,
          stripePaymentIntentId: session.payment_intent as string || '',
          receiptUrl: session.url || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Activate client subscription record if recurring
        if (session.mode === 'subscription') {
          const subId = `sub_${Date.now()}`;
          await db.collection('subscriptions').doc(subId).set({
            id: subId,
            clientId,
            serviceId: session.metadata?.planKey || 'custom',
            planName: planTitle,
            stripeCustomerId: session.customer as string || '',
            stripeSubscriptionId: session.subscription as string || '',
            status: 'active',
            amountCents: amount,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Create paid invoice record
        const invoiceId = `inv_${Date.now()}`;
        await db.collection('invoices').doc(invoiceId).set({
          id: invoiceId,
          invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          clientId,
          amountCents: amount,
          status: 'paid',
          dueDate: new Date().toISOString().split('T')[0],
          description: planTitle,
          stripePaymentIntentId: session.payment_intent as string || '',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Notification for client
        await db.collection('notifications').add({
          id: `notif_${Date.now()}`,
          userId: clientId,
          title: 'Payment Received & Verified',
          message: `Your payment of $${(amount / 100).toFixed(2)} for ${planTitle} was successfully processed.`,
          type: 'billing',
          link: '/client_portal',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send email receipt
        if (session.customer_email) {
          await sendTransactionalEmail({
            to: session.customer_email,
            subject: 'Payment Receipt: A/R Tax Services, LLC',
            category: 'invoice',
            html: `
              <div style="font-family: sans-serif; color: #07172B; padding: 20px;">
                <h2 style="color: #C6A15B;">A/R Tax Services, LLC</h2>
                <p>Thank you for your payment.</p>
                <p><strong>Item:</strong> ${planTitle}</p>
                <p><strong>Amount Paid:</strong> $${(amount / 100).toFixed(2)} USD</p>
                <p><strong>Status:</strong> Paid & Verified</p>
                <p>Your engagement dashboard has been activated.</p>
              </div>
            `
          });
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`[Stripe] Invoice payment failed for customer ${invoice.customer}`);
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  // Atomically record event as processed
  await eventRef.set({
    id: event.id,
    eventType: event.type,
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ received: true });
});
