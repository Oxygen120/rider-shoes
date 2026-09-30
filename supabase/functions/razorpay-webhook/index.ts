import { errorResponse, isRecord, json, optionsResponse } from '../_shared/http.ts';
import { requireEnv } from '../_shared/env.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import {
  safePaymentPayload,
  sha256Hex,
  verifyHmacHex,
} from '../_shared/razorpay.ts';

type PaymentState = 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';

function nestedRecord(
  value: unknown,
  ...keys: string[]
): Record<string, unknown> | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current) || !isRecord(current[key])) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapPaymentState(eventType: string): PaymentState | null {
  if (eventType === 'payment.authorized') return 'authorized';
  if (eventType === 'payment.captured' || eventType === 'order.paid') return 'captured';
  if (eventType === 'payment.failed') return 'failed';
  if (eventType === 'refund.processed' || eventType === 'refund.created') return 'refunded';
  return null;
}

function eventStatusToOrderPayment(status: PaymentState): string {
  if (status === 'captured') return 'paid';
  if (status === 'authorized') return 'authorized';
  if (status === 'refunded') return 'refunded';
  if (status === 'partially_refunded') return 'partially_refunded';
  return 'failed';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await request.text();
  const suppliedSignature = request.headers.get('x-razorpay-signature') || '';
  let signatureValid = false;
  try {
    signatureValid = await verifyHmacHex(
      requireEnv('RAZORPAY_WEBHOOK_SECRET'),
      rawBody,
      suppliedSignature,
    );
  } catch (error) {
    console.error('Webhook secret is not configured');
    return errorResponse(error);
  }
  if (!signatureValid) {
    return json({ error: 'Invalid webhook signature' }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid webhook payload' }, 400);
  }
  if (!isRecord(payload)) return json({ error: 'Invalid webhook payload' }, 400);

  const resolvedEventId =
    textValue(request.headers.get('x-razorpay-event-id')) ||
    textValue(payload.id) ||
    await sha256Hex(rawBody);

  try {
    const admin = createAdminClient();
    const eventType = textValue(payload.event) || 'unknown';
    const eventId = resolvedEventId;
    const payloadHash = await sha256Hex(rawBody);

    const { data: existingEvent } = await admin
      .from('payment_webhook_events')
      .select('status')
      .eq('event_id', eventId)
      .maybeSingle();
    if (existingEvent?.status === 'processed' || existingEvent?.status === 'ignored') {
      return json({ received: true, duplicate: true });
    }

    const { error: eventInsertError } = await admin
      .from('payment_webhook_events')
      .upsert({
        event_id: eventId,
        event_type: eventType,
        payload_hash: payloadHash,
        status: 'received',
        error_message: null,
      }, { onConflict: 'event_id', ignoreDuplicates: false });
    if (eventInsertError) {
      // A concurrent delivery may have inserted the same event. It is safe to
      // acknowledge it; the other worker owns processing for that event.
      const { data: concurrentEvent } = await admin
        .from('payment_webhook_events')
        .select('status')
        .eq('event_id', eventId)
        .maybeSingle();
      if (concurrentEvent) return json({ received: true, duplicate: true });
      throw eventInsertError;
    }

    // TODO(production): dispatch verified events to a durable queue and claim
    // each event under a database lock. The unique event row makes ordinary
    // retries idempotent, while a queue/lease closes the concurrent-worker gap.

    const payment = nestedRecord(payload, 'payload', 'payment', 'entity');
    const orderEntity = nestedRecord(payload, 'payload', 'order', 'entity');
    const refund = nestedRecord(payload, 'payload', 'refund', 'entity');
    let paymentState = mapPaymentState(eventType);

    if (!paymentState) {
      await admin
        .from('payment_webhook_events')
        .update({ status: 'ignored', processed_at: new Date().toISOString() })
        .eq('event_id', eventId);
      return json({ received: true, ignored: true });
    }

    const providerPaymentId = textValue(payment?.id) || textValue(refund?.payment_id);
    const providerOrderId = textValue(payment?.order_id) || textValue(orderEntity?.id);
    if (!providerOrderId) {
      await admin
        .from('payment_webhook_events')
        .update({
          status: 'ignored',
          error_message: 'Webhook did not contain a provider order id',
          processed_at: new Date().toISOString(),
        })
        .eq('event_id', eventId);
      return json({ received: true, ignored: true });
    }

    let localPayment: Record<string, unknown> | null = null;
    if (providerPaymentId) {
      const { data } = await admin
        .from('payments')
        .select('id, order_id, amount, currency, status, provider_payment_id')
        .eq('provider', 'razorpay')
        .eq('provider_payment_id', providerPaymentId)
        .maybeSingle();
      localPayment = data;
    }
    if (!localPayment) {
      const { data } = await admin
        .from('payments')
        .select('id, order_id, amount, currency, status, provider_payment_id')
        .eq('provider', 'razorpay')
        .eq('provider_order_id', providerOrderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      localPayment = data;
    }

    if (!localPayment) {
      await admin
        .from('payment_webhook_events')
        .update({
          status: 'ignored',
          error_message: 'No local payment session matched provider order',
          processed_at: new Date().toISOString(),
        })
        .eq('event_id', eventId);
      // Acknowledge unknown orders so a malicious/old webhook cannot cause an
      // endless retry loop. Operators can inspect the event status in Supabase.
      return json({ received: true, ignored: true });
    }

    const { data: localOrder, error: localOrderError } = await admin
      .from('orders')
      .select('id, status, payment_status, total_amount, amount_paid, amount_refunded, currency')
      .eq('id', localPayment.order_id)
      .maybeSingle();
    if (localOrderError || !localOrder) throw localOrderError || new Error('Local order missing');

    const providerAmount = Number(payment?.amount ?? orderEntity?.amount);
    const expectedProviderAmount = Math.round(Number(localOrder.total_amount) * 100);
    const providerCurrency = textValue(payment?.currency) || textValue(orderEntity?.currency);
    if (
      paymentState !== 'failed' &&
      !eventType.startsWith('refund.') &&
      (
        !Number.isFinite(providerAmount) ||
        providerAmount !== expectedProviderAmount ||
        (providerCurrency !== null && providerCurrency !== localOrder.currency)
      )
    ) {
      await admin
        .from('payment_webhook_events')
        .update({
          status: 'failed',
          error_message: 'Provider amount or currency did not match local order',
          processed_at: new Date().toISOString(),
        })
        .eq('event_id', eventId);
      return json({ received: true, rejected: true });
    }

    // Do not let a delayed lower-precedence event downgrade settled state.
    if (
      ['captured', 'partially_refunded', 'refunded'].includes(String(localPayment.status)) &&
      ['authorized', 'failed'].includes(paymentState)
    ) {
      await admin
        .from('payment_webhook_events')
        .update({ status: 'ignored', processed_at: new Date().toISOString() })
        .eq('event_id', eventId);
      return json({ received: true, ignored: true });
    }

    let refundTotal = Number(localOrder.amount_refunded);
    if (eventType.startsWith('refund.')) {
      const providerRefundTotal = Number(payment?.amount_refunded);
      const providerRefundDelta = Number(refund?.amount);
      refundTotal = Number.isFinite(providerRefundTotal)
        ? providerRefundTotal / 100
        : refundTotal + (Number.isFinite(providerRefundDelta) ? providerRefundDelta / 100 : 0);
      refundTotal = Math.min(refundTotal, Number(localOrder.amount_paid || localOrder.total_amount));
      paymentState = refundTotal >= Number(localOrder.total_amount)
        ? 'refunded'
        : 'partially_refunded';
    }

    const safePayload = payment || refund || orderEntity || {};
    const paymentUpdate: Record<string, unknown> = {
      provider_order_id: providerOrderId,
      status: paymentState,
      amount: Number(localPayment.amount),
      provider_amount: Number.isFinite(providerAmount) ? providerAmount : expectedProviderAmount,
      currency: localPayment.currency,
      method: textValue(payment?.method),
      signature_verified: true,
      raw_response: safePaymentPayload(safePayload),
      failure_code: textValue(payment?.error_code),
      failure_message: textValue(payment?.error_description),
    };
    if (providerPaymentId) paymentUpdate.provider_payment_id = providerPaymentId;
    if (paymentState === 'captured') paymentUpdate.paid_at = new Date().toISOString();
    const { error: paymentUpdateError } = await admin
      .from('payments')
      .update(paymentUpdate)
      .eq('id', localPayment.id);
    if (paymentUpdateError) throw paymentUpdateError;

    const orderPaymentStatus = eventStatusToOrderPayment(paymentState);
    const orderUpdate: Record<string, unknown> = {
      payment_status: orderPaymentStatus,
    };
    if (paymentState === 'captured') {
      const { error: inventoryError } = await admin.rpc('_commit_order_inventory', { _order_id: localPayment.order_id });
      if (inventoryError) throw inventoryError;
      orderUpdate.amount_paid = Number(localOrder.total_amount);
      orderUpdate.paid_at = new Date().toISOString();
      if (localOrder.status === 'pending') orderUpdate.status = 'confirmed';
    } else if (paymentState === 'partially_refunded' || paymentState === 'refunded') {
      orderUpdate.amount_refunded = refundTotal;
      if (paymentState === 'refunded') orderUpdate.status = 'refunded';
    }
    const { error: orderUpdateError } = await admin
      .from('orders')
      .update(orderUpdate)
      .eq('id', localPayment.order_id)
      .neq('status', 'cancelled');
    if (orderUpdateError) throw orderUpdateError;

    await admin
      .from('payment_webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null })
      .eq('event_id', eventId);

    return json({ received: true });
  } catch (error) {
    console.error('razorpay-webhook processing failed');
    // Best-effort state update. The generic 500 prompts Razorpay to retry.
    try {
      const admin = createAdminClient();
      await admin
        .from('payment_webhook_events')
        .update({ status: 'failed', error_message: 'Processing failed' })
        .eq('event_id', resolvedEventId);
    } catch {
      // Do not mask the original failure or expose configuration details.
    }
    return json({ error: 'Webhook processing failed' }, 500);
  }
});
