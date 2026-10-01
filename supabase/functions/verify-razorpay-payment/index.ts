import { errorResponse, isRecord, json, optionsResponse, parseJson } from '../_shared/http.ts';
import { requireEnv } from '../_shared/env.ts';
import { createAdminClient, AuthenticationError, getOptionalUser } from '../_shared/supabase.ts';
import { razorpayFetch, RazorpayRequestError, safePaymentPayload, verifyHmacHex } from '../_shared/razorpay.ts';

function stringField(body: Record<string, unknown>, key: string): string | null { const value = body[key]; return typeof value === 'string' && value.trim() ? value.trim() : null; }
const normalizePhone = (value: string) => value.replace(/\D/g, '');
const normalizeEmail = (value: string) => value.trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await parseJson(request);
    if (!isRecord(body)) return json({ error: 'Invalid request body' }, 400);
    const orderId = stringField(body, 'orderId');
    const razorpayOrderId = stringField(body, 'razorpayOrderId');
    const razorpayPaymentId = stringField(body, 'razorpayPaymentId');
    const razorpaySignature = stringField(body, 'razorpaySignature');
    const customerPhone = stringField(body, 'customerPhone');
    const customerEmail = stringField(body, 'customerEmail');
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return json({ error: 'orderId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required' }, 400);
    const user = await getOptionalUser(request);
    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin.from('orders').select('id, profile_id, status, currency, total_amount, payment_status, shipping_address').eq('id', orderId).maybeSingle();
    if (orderError || !order) return json({ error: 'Order not found' }, 404);

    if (user) {
      if (order.profile_id !== user.id) return json({ error: 'Order not found' }, 404);
    } else {
      if (order.profile_id) return json({ error: 'Authentication required for this order' }, 401);
      const shipping = isRecord(order.shipping_address) ? order.shipping_address : {};
      const orderPhone = typeof shipping.phone === 'string' ? normalizePhone(shipping.phone) : '';
      const orderEmail = typeof shipping.email === 'string' ? normalizeEmail(shipping.email) : '';
      const suppliedPhone = customerPhone ? normalizePhone(customerPhone) : '';
      const suppliedEmail = customerEmail ? normalizeEmail(customerEmail) : '';
      if (!suppliedPhone || !orderPhone || suppliedPhone !== orderPhone || (suppliedEmail && orderEmail && suppliedEmail !== orderEmail)) return json({ error: 'Customer details do not match this order' }, 403);
    }

    if (order.status === 'cancelled' || order.status === 'refunded') return json({ error: 'Order cannot accept a payment' }, 409);
    const { data: localPayment, error: localPaymentError } = await admin.from('payments').select('id, provider_order_id, amount, provider_amount, currency, status').eq('order_id', order.id).eq('provider', 'razorpay').eq('provider_order_id', razorpayOrderId).maybeSingle();
    if (localPaymentError || !localPayment) return json({ error: 'Payment session not found' }, 404);
    const signatureValid = await verifyHmacHex(requireEnv('RAZORPAY_KEY_SECRET'), `${razorpayOrderId}|${razorpayPaymentId}`, razorpaySignature);
    if (!signatureValid) return json({ error: 'Payment signature could not be verified' }, 400);
    let providerPayment: Record<string, unknown>;
    try { providerPayment = await razorpayFetch<Record<string, unknown>>(`/payments/${encodeURIComponent(razorpayPaymentId)}`, { method: 'GET' }); } catch (error) { if (error instanceof RazorpayRequestError) return json({ error: 'Unable to confirm payment with provider' }, 502); throw error; }
    const providerOrderId = providerPayment.order_id;
    const providerAmount = Number(providerPayment.amount);
    const expectedAmount = Math.round(Number(order.total_amount) * 100);
    if (providerOrderId !== razorpayOrderId || !Number.isFinite(providerAmount) || providerAmount !== expectedAmount || providerPayment.currency !== order.currency) return json({ error: 'Payment amount or order does not match' }, 400);
    const providerStatus = typeof providerPayment.status === 'string' ? providerPayment.status : '';
    if (providerStatus !== 'captured' && providerStatus !== 'authorized') return json({ verified: false, status: providerStatus || 'pending' }, 202);
    const localPaymentStatus = providerStatus === 'captured' ? 'captured' : 'authorized';
    const { error: paymentUpdateError } = await admin.from('payments').update({ provider_payment_id: razorpayPaymentId, provider_amount: providerAmount, amount: Number(order.total_amount), currency: order.currency, status: localPaymentStatus, method: typeof providerPayment.method === 'string' ? providerPayment.method : null, signature_verified: true, raw_response: safePaymentPayload(providerPayment), paid_at: providerStatus === 'captured' ? new Date().toISOString() : null }).eq('id', localPayment.id);
    if (paymentUpdateError) return json({ error: 'Unable to record payment' }, 500);
    if (providerStatus === 'captured') {
      const { error: inventoryError } = await admin.rpc('_commit_order_inventory', { _order_id: order.id });
      if (inventoryError) return json({ error: 'Payment verified; inventory reconciliation is required' }, 500);
      const { error: orderUpdateError } = await admin.from('orders').update({ payment_status: 'paid', amount_paid: Number(order.total_amount), paid_at: new Date().toISOString(), status: order.status === 'pending' ? 'confirmed' : order.status }).eq('id', order.id).neq('status', 'cancelled');
      if (orderUpdateError) return json({ error: 'Payment recorded; order update requires reconciliation' }, 500);
    } else {
      const { error: orderUpdateError } = await admin.from('orders').update({ payment_status: 'authorized' }).eq('id', order.id).neq('status', 'cancelled');
      if (orderUpdateError) return json({ error: 'Payment recorded; order update requires reconciliation' }, 500);
    }
    return json({ verified: true, status: providerStatus, orderId: order.id, paymentId: localPayment.id });
  } catch (error) {
    if (error instanceof AuthenticationError) return json({ error: error.message }, error.status);
    if (error instanceof Error && error.message === 'Request body must be valid JSON') return json({ error: error.message }, 400);
    console.error('verify-razorpay-payment failed');
    return errorResponse(error);
  }
});
