import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../app/AppContext";
import { Breadcrumbs } from "../components/SiteLayout";
import { EmptyState } from "../components/Ui";

export function CartPage() {
  const { cart, settings, updateCartQuantity, removeFromCart } = useApp();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const discount = couponApplied ? Math.round(subtotal * .1) : 0;
  const shipping = subtotal - discount >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;
  const total = Math.max(0, subtotal - discount + shipping);
  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === "RIDER10") { setCouponApplied(true); setCouponMessage("10% welcome offer applied"); }
    else { setCouponApplied(false); setCouponMessage("Try RIDER10 for 10% off in this demo"); }
  };
  return (
    <>
      <div className="page-hero"><div className="container-wide"><div className="eyebrow">Your rotation</div><h1 className="display-title">Shopping bag</h1><p>Easy decisions, no rush. Your saved pairs stay here while you decide.</p></div></div>
      <Breadcrumbs current="Shopping bag" />
      <section className="section"><div className="container-wide">{cart.length === 0 ? <div className="cart-list"><EmptyState icon={ShoppingBag} title="Your bag is waiting" description="Add a pair or two and they will show up here, ready for the next step." action={<Link className="button button-primary" to="/shop">Explore the collection <ArrowRight size={14} /></Link>} /></div> : <div className="cart-layout"><div className="cart-list"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 15px" }}><strong>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</strong><span style={{ color: "var(--muted)", fontSize: ".7rem" }}>Stored securely in this browser</span></div>{cart.map((item) => <div className="cart-row" key={item.id}><img src={item.imageUrl} alt={item.productName} /><div><Link to={`/product/${item.productSlug}`}><h3>{item.productName}</h3></Link><p>{item.color ?? ""}{item.size ? ` · Size ${item.size}` : ""} · {item.sku}</p><div className="row-actions"><div className="quantity-control"><button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity"><Minus size={13} /></button><strong style={{ fontSize: ".75rem" }}>{item.quantity}</strong><button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity"><Plus size={13} /></button></div><button className="text-button" onClick={() => removeFromCart(item.id)}><Trash2 size={13} style={{ verticalAlign: "middle" }} /> Remove</button></div></div><div className="cart-price">₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}</div></div>)}<div style={{ padding: "17px 0 3px" }}><Link to="/shop" style={{ color: "var(--coral)", fontSize: ".75rem", fontWeight: 800 }}><ArrowRight size={13} style={{ verticalAlign: "middle", marginRight: 4 }} /> Continue shopping</Link></div></div><aside className="summary-card"><h2>Order summary</h2><div className="summary-line"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div><div className="summary-line"><span>Discount</span><span style={{ color: couponApplied ? "#31815c" : undefined }}>{discount ? `− ₹${discount.toLocaleString("en-IN")}` : "—"}</span></div><div className="summary-line"><span>Delivery</span><span>{shipping ? `₹${shipping.toLocaleString("en-IN")}` : <span style={{ color: "#31815c" }}>Free</span>}</span></div><div className="summary-line total"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div><div className="summary-note"><LockKeyhole size={14} /> Secure checkout · {settings.deliveryEstimate}</div><div style={{ display: "flex", gap: 8, margin: "11px 0 17px" }}><div style={{ position: "relative", flex: 1 }}><Tag size={14} style={{ position: "absolute", left: 11, top: 13, color: "var(--muted)" }} /><input style={{ width: "100%", minHeight: 41, border: "1px solid var(--line)", borderRadius: 10, padding: "0 10px 0 32px", fontSize: ".72rem" }} value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="Coupon code" aria-label="Coupon code" /></div><button className="button button-outline button-small" onClick={applyCoupon}>Apply</button></div>{couponMessage && <div style={{ marginBottom: 13, color: couponApplied ? "#31815c" : "var(--coral)", fontSize: ".7rem" }}>{couponMessage}</div>}<button className="button button-primary button-block" onClick={() => navigate("/checkout")}>Continue to checkout <ArrowRight size={15} /></button></aside></div>}</div></section>
    </>
  );
}
