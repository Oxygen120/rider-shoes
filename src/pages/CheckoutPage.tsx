import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, type CheckoutDetails } from "../app/AppContext";
import { useAuth } from "../app/AuthContext";
import { getSupabaseClient } from "../lib/supabase";
import { Breadcrumbs } from "../components/SiteLayout";
import { Field } from "../components/Ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const loadRazorpay = async (): Promise<boolean> => {
  if (window.Razorpay) return true;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
  return Boolean(window.Razorpay);
};

const initialForm: CheckoutDetails = { name: "", email: "", phone: "", addressLine1: "", addressLine2: "", city: "Dhanera", state: "Gujarat", postalCode: "", paymentMethod: "cod" };

export function CheckoutPage() {
  const { cart, settings, createOrder } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutDetails>(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const shipping = subtotal >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;
  const total = subtotal + shipping;
  const setField = (field: keyof CheckoutDetails, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (cart.length === 0) { setError("Your bag is empty. Add a pair before checking out."); return; }
    if (!/^\d{6}$/.test(form.postalCode)) { setError("Enter a valid 6-digit delivery pincode."); return; }
    if (!/^\+?[0-9\s-]{10,15}$/.test(form.phone)) { setError("Enter a valid mobile number."); return; }
    setSubmitting(true);
    try {
      if (form.paymentMethod === "razorpay" && !user) {
        throw new Error("Please sign in before using Razorpay. Cash on delivery is available without an account.");
      }
      const order = await createOrder(form);
      if (!order) throw new Error("We could not create your order. Please try again.");

      if (form.paymentMethod === "razorpay") {
        const client = getSupabaseClient();
        if (!client) throw new Error("Payment service is not configured.");
        const loaded = await loadRazorpay();
        if (!loaded || !window.Razorpay) throw new Error("Razorpay checkout could not be loaded.");
        const { data, error: initError } = await client.functions.invoke("create-razorpay-order", { body: { orderId: order.id } });
        if (initError || !data?.razorpayOrderId || !data?.keyId) throw new Error(initError?.message || data?.error || "Unable to initialize online payment.");
        const Razorpay = window.Razorpay;
        const payment = new Razorpay({
          key: data.keyId, amount: data.amount, currency: data.currency, name: settings.storeName,
          description: `Rider Shoes order ${order.orderNumber}`, order_id: data.razorpayOrderId,
          prefill: { name: form.name, email: form.email, contact: form.phone },
          notes: { local_order_id: order.id },
          theme: { color: "#e76f51" },
          handler: async (response: Record<string, unknown>) => {
            try {
              const { error: verifyError } = await client.functions.invoke("verify-razorpay-payment", { body: {
                orderId: order.id, razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature,
              }});
              if (verifyError) throw verifyError;
              navigate(`/order-success?order=${encodeURIComponent(order.orderNumber)}`);
            } catch (verifyError) {
              setError(verifyError instanceof Error ? verifyError.message : "Payment verification failed. Your order remains safely reserved.");
              setSubmitting(false);
            }
          },
          modal: { ondismiss: () => setSubmitting(false) },
        });
        payment.open();
        return;
      }
      navigate(`/order-success?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to place your order.");
      setSubmitting(false);
    }
  };
  if (cart.length === 0) return <div className="section"><div className="container-narrow"><div className="empty-state"><h2>Your bag is empty</h2><p>Add something good before you check out.</p><Link className="button button-primary" to="/shop">Go to shop <ArrowRight size={14} /></Link></div></div></div>;
  return (
    <>
      <div className="page-hero"><div className="container-wide"><div className="eyebrow">Almost there</div><h1 className="display-title">Checkout</h1><p>One calm, secure step from your shortlist to your doorstep.</p></div></div>
      <Breadcrumbs current="Checkout" />
      <section className="section"><div className="container-wide"><form className="checkout-grid" onSubmit={submit}><div style={{ display: "grid", gap: 14 }}><div className="form-card"><h2>Delivery details</h2><div className="form-grid"><Field label="Full name" name="name" value={form.name} onChange={(value) => setField("name", value)} required placeholder="Your name" /><Field label="Mobile number" name="phone" value={form.phone} onChange={(value) => setField("phone", value)} required placeholder="+91 99791 31767" /><Field label="Email address" name="email" type="email" value={form.email} onChange={(value) => setField("email", value)} required placeholder="you@example.com" /><Field label="Pincode" name="postalCode" value={form.postalCode} onChange={(value) => setField("postalCode", value.replace(/\D/g, "").slice(0, 6))} required placeholder="385310" /><Field label="Address" name="addressLine1" value={form.addressLine1} onChange={(value) => setField("addressLine1", value)} required placeholder="House number and street" full /><Field label="Apartment, landmark (optional)" name="addressLine2" value={form.addressLine2} onChange={(value) => setField("addressLine2", value)} placeholder="Near..." full /><Field label="City" name="city" value={form.city} onChange={(value) => setField("city", value)} required /><Field label="State" name="state" value={form.state} onChange={(value) => setField("state", value)} required /></div></div><div className="form-card"><h2>Payment method</h2><div className="payment-options"><label className={`payment-option ${form.paymentMethod === "cod" ? "active" : ""}`}><input type="radio" name="payment" checked={form.paymentMethod === "cod"} onChange={() => setField("paymentMethod", "cod")} /> <span><strong>Cash on delivery</strong><br /><small style={{ color: "var(--muted)" }}>Pay when your order arrives</small></span></label><label className={`payment-option ${form.paymentMethod === "razorpay" ? "active" : ""}`}><input type="radio" name="payment" checked={form.paymentMethod === "razorpay"} onChange={() => setField("paymentMethod", "razorpay")} /> <span><strong>Razorpay</strong><br /><small style={{ color: "var(--muted)" }}>UPI, cards and net banking · server verified</small></span></label></div>{form.paymentMethod === "razorpay" && <div style={{ marginTop: 14, padding: 12, borderRadius: 11, color: "#8b641d", background: "#fff3d6", fontSize: ".7rem" }}>Secure payment opens in Razorpay. Your order is reserved until the payment is verified.</div>}{error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}</div><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><Link className="button button-outline" to="/cart"><ArrowLeft size={14} /> Back to bag</Link><button type="submit" className="button button-primary" disabled={submitting}>{submitting ? "Creating order..." : <>Place order <ArrowRight size={15} /></>}</button></div></div><aside className="summary-card"><h2>Order summary</h2>{cart.map((item) => <div className="summary-line" key={item.id} style={{ alignItems: "start" }}><span style={{ display: "flex", gap: 9 }}><img src={item.imageUrl} alt="" style={{ width: 42, height: 36, borderRadius: 7, objectFit: "cover" }} />{item.productName} <small style={{ color: "var(--muted)" }}>× {item.quantity}</small></span><strong>₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}</strong></div>)}<div className="summary-line"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div><div className="summary-line"><span>Delivery</span><span>{shipping ? `₹${shipping.toLocaleString("en-IN")}` : <span style={{ color: "#31815c" }}>Free</span>}</span></div><div className="summary-line total"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div><div className="summary-note"><LockKeyhole size={14} /> Your details stay protected</div><div className="detail-meta"><div className="meta-tile"><ShieldCheck size={15} /><span>Secure</span></div><div className="meta-tile"><Truck size={15} /><span>{settings.deliveryEstimate}</span></div><div className="meta-tile"><CheckCircle2 size={15} /><span>Easy returns</span></div></div></aside></form></div></section>
    </>
  );
}
