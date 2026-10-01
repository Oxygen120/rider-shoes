import { errorResponse, isRecord, json, optionsResponse, parseJson } from '../_shared/http.ts';
import { requireEnv } from '../_shared/env.ts';
import { createAdminClient, AuthenticationError, getOptionalUser } from '../_shared/supabase.ts';
import { razorpayFetch, RazorpayRequestError, type RazorpayOrder } from '../_shared/razorpay.ts';

const allowedOrderStatuses = new Set(['pending', 'payment_pending', 'confirmed']);
const allowedPaymentStatuses = new Set(['pending', 'failed']);
const normalizePhone = (value: string) => value.replace(/\D/g, '');
const normalizeEmail = (value: string) => value.trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await parseJson(request);
    if (!isRecord(body) || typeof body.orderId !== 'string' || !body.orderId.trim()) return json({ error: 'orderId is required' }, 400);
    const orderId = body.orderId.trim();
    const customerPhone = typeof body.customerPhone === 'string' ? normalizePhone(body.customerPhone) : '';
    const customerEmail = typeof body.customerEmail === 'string' ? normalizeEmail(body.customerEmail) : '';
    const user = await getOptionalUser(request);
    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin.from('orders').select('id, order_number, profile_id, currency, total_amount, status, payment_status, shipping_address').eq('id', orderId).maybeSingle();
    if (orderError || !order) return json({ error: 'Order not found' }, 404);

    if (user) {
      if (order.profile_id !== user.id) return json({ error: 'Order not found' }, 404);
    } else {
      if (order.profile_id) return json({ error: 'Authentication required for this order' }, 401);
      const shipping = isRecord(order.shipping_address) ? order.shipping_address : {};
      const orderPhone = typeof shipping.phone === 'string' ? normalizePhone(shipping.phone) : '';
      const orderEmail = typeof shipping.email === 'string' ? normalizeEmail(shipping.email) : '';
      if (!customerPhone || !orderPhone || customerPhone !== orderPhone || (customerEmail && orderEmail && customerEmail !== orderEmail)) return json({ error: 'Customer details do not match this order' }, 403);
    }

    if (!allowedOrderStatuses.has(order.status) || !allowedPaymentStatuses.has(order.payment_status)) return json({ error: 'Order is not eligible for payment' }, 409);
    const amountInMajorUnits = Number(order.total_amount);
    const amountInSmallestUnit = Math.round(amountInMajorUnits * 100);
    if (!Number.isFinite(amountInSmallestUnit) || amountInSmallestUnit <= 0) return json({ error: 'Order has an invalid payable amount' }, 422);
    const { data: existingPayment } = await admin.from('payments').select('id, provider_order_id, provider_amount, amount, currency, status').eq('order_id', order.id).eq('provider', 'razorpay').in('status', ['created', 'authorized']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const keyId = requireEnv('RAZORPAY_KEY_ID');
    if (existingPayment?.provider_order_id && Number(existingPayment.provider_amount) === amountInSmallestUnit) return json({ orderId: order.id, orderNumber: order.order_number, razorpayOrderId: existingPayment.provider_order_id, paymentId: existingPayment.id, amount: amountInSmallestUnit, currency: order.currency, keyId });
    const razorpayOrder = await razorpayFetch<RazorpayOrder>('/orders', { method: 'POST', body: JSON.stringify({ amount: amountInSmallestUnit, currency: order.currency, receipt: order.order_number, notes: { local_order_id: order.id } }) });
    if (!razorpayOrder?.id || Number(razorpayOrder.amount) !== amountInSmallestUnit || razorpayOrder.currency !== order.currency) return json({ error: 'Payment provider returned an invalid order' }, 502);
    const { data: payment, error: paymentError } = await admin.from('payments').insert({ order_id: order.id, provider: 'razorpay', provider_order_id: razorpayOrder.id, amount: amountInMajorUnits, provider_amount: amountInSmallestUnit, currency: order.currency, status: 'created', raw_response: { id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, receipt: razorpayOrder.receipt, status: razorpayOrder.status } }).select('id').single();
    if (paymentError || !payment) return json({ error: 'Unable to initialize payment' }, 502);
    return json({ orderId: order.id, orderNumber: order.order_number, razorpayOrderId: razorpayOrder.id, paymentId: payment.id, amount: amountInSmallestUnit, currency: order.currency, keyId });
  } catch (error) {
    if (error instanceof AuthenticationError) return json({ error: error.message }, error.status);
    if (error instanceof RazorpayRequestError) return json({ error: 'Payment provider unavailable' }, 502);
    if (error instanceof Error && error.message === 'Request body must be valid JSON') return json({ error: error.message }, 400);
    console.error('create-razorpay-order failed');
    return errorResponse(error);
  }
});
