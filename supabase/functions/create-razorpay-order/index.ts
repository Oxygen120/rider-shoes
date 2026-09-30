import { errorResponse, isRecord, json, optionsResponse, parseJson } from '../_shared/http.ts';
import { requireEnv } from '../_shared/env.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import {
  razorpayFetch,
  RazorpayRequestError,
  type RazorpayOrder,
} from '../_shared/razorpay.ts';

const allowedOrderStatuses = new Set(['pending', 'payment_pending', 'confirmed']);
const allowedPaymentStatuses = new Set(['pending', 'failed']);

async function resolveUserId(request: Request, admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const authorization = request.headers.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data } = await admin.auth.getUser(match[1]);
  return data.user?.id ?? null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await parseJson(request);
    if (!isRecord(body) || typeof body.orderId !== 'string' || !body.orderId.trim()) {
      return json({ error: 'orderId is required' }, 400);
    }

    const orderId = body.orderId.trim();
    const admin = createAdminClient();
    const userId = await resolveUserId(request, admin);
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, order_number, profile_id, currency, total_amount, status, payment_status')
      .eq('id', orderId)
      .maybeSingle();

    // Guest orders have a null profile_id and are protected by an unguessable
    // UUID order id. Signed-in orders must still belong to the signed-in user.
    const ownsOrder = order && (order.profile_id ? order.profile_id === userId : userId === null);
    if (orderError || !order || !ownsOrder) return json({ error: 'Order not found' }, 404);
    if (!allowedOrderStatuses.has(order.status) || !allowedPaymentStatuses.has(order.payment_status)) {
      return json({ error: 'Order is not eligible for payment' }, 409);
    }

    const amountInMajorUnits = Number(order.total_amount);
    const amountInSmallestUnit = Math.round(amountInMajorUnits * 100);
    if (!Number.isFinite(amountInSmallestUnit) || amountInSmallestUnit <= 0) {
      return json({ error: 'Order has an invalid payable amount' }, 422);
    }

    const { data: existingPayment } = await admin
      .from('payments')
      .select('id, provider_order_id, provider_amount, amount, currency, status')
      .eq('order_id', order.id)
      .eq('provider', 'razorpay')
      .in('status', ['created', 'authorized'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const keyId = requireEnv('RAZORPAY_KEY_ID');
    if (existingPayment?.provider_order_id && Number(existingPayment.provider_amount) === amountInSmallestUnit) {
      return json({
        orderId: order.id,
        orderNumber: order.order_number,
        razorpayOrderId: existingPayment.provider_order_id,
        paymentId: existingPayment.id,
        amount: amountInSmallestUnit,
        currency: order.currency,
        keyId,
      });
    }

    const razorpayOrder = await razorpayFetch<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountInSmallestUnit,
        currency: order.currency,
        receipt: order.order_number,
        notes: { local_order_id: order.id },
      }),
    });

    if (!razorpayOrder?.id || Number(razorpayOrder.amount) !== amountInSmallestUnit || razorpayOrder.currency !== order.currency) {
      return json({ error: 'Payment provider returned an invalid order' }, 502);
    }

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        order_id: order.id,
        provider: 'razorpay',
        provider_order_id: razorpayOrder.id,
        amount: amountInMajorUnits,
        provider_amount: amountInSmallestUnit,
        currency: order.currency,
        status: 'created',
        raw_response: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt,
          status: razorpayOrder.status,
        },
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      console.error('Unable to persist local Razorpay payment record');
      return json({ error: 'Unable to initialize payment' }, 502);
    }

    return json({
      orderId: order.id,
      orderNumber: order.order_number,
      razorpayOrderId: razorpayOrder.id,
      paymentId: payment.id,
      amount: amountInSmallestUnit,
      currency: order.currency,
      keyId,
    });
  } catch (error) {
    if (error instanceof RazorpayRequestError) return json({ error: 'Payment provider unavailable' }, 502);
    if (error instanceof Error && error.message === 'Request body must be valid JSON') return json({ error: error.message }, 400);
    console.error('create-razorpay-order failed');
    return errorResponse(error);
  }
});
