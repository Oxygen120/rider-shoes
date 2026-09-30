import { useMemo, useState } from "react";
import { ArrowRight, Check, Heart, Minus, Plus, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../app/AppContext";
import { Breadcrumbs } from "../components/SiteLayout";
import { ProductCard, SectionHeading, Stars } from "../components/Ui";

export function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { products, addToCart, toggleWishlist, isWishlisted, settings } = useApp();
  const product = products.find((item) => item.slug === slug);
  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState(product?.sizes[0] ?? "");
  const [color, setColor] = useState(product?.colors[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [pincode, setPincode] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const variant = useMemo(() => product?.variants.find((item) => item.size === size && item.color === color) ?? product?.variants[0], [color, product?.variants, size]);
  if (!product) return <div className="section"><div className="container-narrow"><div className="empty-state"><h2>That pair has moved on.</h2><p>We could not find this product, but there are plenty more steps to explore.</p><Link className="button button-primary" to="/shop">Back to shop <ArrowRight size={14} /></Link></div></div></div>;
  const saved = isWishlisted(product.id);
  const discount = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const related = products.filter((item) => item.id !== product.id && item.categoryIds.some((id) => product.categoryIds.includes(id))).slice(0, 4);
  const checkDelivery = () => {
    const allowed = ["385310", "560001", "380001", "110001", "400001"];
    setDeliveryMessage(pincode.length === 6 && allowed.includes(pincode) ? `Good news — we deliver to ${pincode}.` : "Enter a serviceable 6-digit pincode to check delivery.");
  };
  const buyNow = () => {
    addToCart(product, variant, quantity);
    navigate("/cart");
  };
  return (
    <>
      <Breadcrumbs current={product.name} />
      <section className="section-tight"><div className="container-wide"><div className="product-detail">
        <div className="gallery"><div className="thumbs">{product.images.map((image, index) => <button key={image.id} className={`thumb ${imageIndex === index ? "active" : ""}`} onClick={() => setImageIndex(index)}><img src={image.url} alt={`${product.name} view ${index + 1}`} /></button>)}</div><div className="gallery-main"><img src={product.images[imageIndex]?.url ?? product.imageUrl} alt={product.images[imageIndex]?.altText ?? product.name} /></div></div>
        <div className="detail-copy"><div className="product-brand">{product.brand?.name ?? "Rider collection"} · {product.badge ?? "Everyday movement"}</div><h1>{product.name}</h1><Stars rating={product.rating ?? 0} reviewCount={product.reviewCount} /><p className="lead">{product.description}</p><div className="detail-price"><span className="price">₹{product.price.toLocaleString("en-IN")}</span>{product.compareAtPrice && <span className="compare">₹{product.compareAtPrice.toLocaleString("en-IN")}</span>}{discount > 0 && <span className="discount">{discount}% off</span>}</div>
          <div className="detail-block"><div className="detail-label"><span>Color</span><span style={{ color: "var(--muted)", fontWeight: 500 }}>{color}</span></div><div className="color-list">{product.colors.map((item) => <button key={item} className={`color-option ${color === item ? "active" : ""}`} onClick={() => setColor(item)}>{item}</button>)}</div></div>
          <div className="detail-block"><div className="detail-label"><span>Size</span><span style={{ color: "var(--coral)", fontWeight: 700 }}>Size guide</span></div><div className="size-list">{product.sizes.map((item) => <button key={item} className={`size-option ${size === item ? "active" : ""}`} onClick={() => setSize(item)}>{item}</button>)}</div></div>
          <div className="detail-block" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15 }}><div><div className="detail-label" style={{ marginBottom: 8 }}>Quantity</div><div className="quantity-control"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus size={14} /></button><strong>{quantity}</strong><button onClick={() => setQuantity((value) => Math.min(5, value + 1))} aria-label="Increase quantity"><Plus size={14} /></button></div></div><span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: product.inStock ? "#31815c" : "var(--coral)", fontSize: ".75rem", fontWeight: 800 }}><Check size={15} />{product.inStock ? "In stock" : "Currently unavailable"}</span></div>
          <div className="detail-actions"><button className="button button-primary" onClick={() => addToCart(product, variant, quantity)} disabled={!product.inStock}><span>Add to bag</span><ArrowRight size={15} /></button><button className="button button-outline" onClick={buyNow} disabled={!product.inStock}>Buy now</button></div><button className={`button button-outline button-block ${saved ? "" : ""}`} style={{ marginTop: 10 }} onClick={() => toggleWishlist(product.id)}><Heart size={15} fill={saved ? "currentColor" : "none"} />{saved ? "Saved to wishlist" : "Add to wishlist"}</button>
          <div className="detail-block"><div className="detail-label"><span>Delivery checker</span><span style={{ color: "var(--muted)", fontWeight: 500 }}>{settings.deliveryEstimate}</span></div><div style={{ display: "flex", gap: 8 }}><input className="field-input" style={{ flex: 1, minHeight: 42, border: "1px solid var(--line)", borderRadius: 11, padding: "0 12px", outline: 0 }} value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter pincode" inputMode="numeric" /><button className="button button-dark button-small" style={{ color: "var(--ink)", background: "var(--mist)" }} onClick={checkDelivery}>Check</button></div>{deliveryMessage && <div style={{ marginTop: 9, color: deliveryMessage.startsWith("Good") ? "#31815c" : "var(--coral)", fontSize: ".7rem" }}>{deliveryMessage}</div>}</div>
          <div className="detail-meta"><div className="meta-tile"><Truck size={16} /><span>Fast delivery</span></div><div className="meta-tile"><RotateCcw size={16} /><span>{settings.returnsWindowDays}-day returns</span></div><div className="meta-tile"><ShieldCheck size={16} /><span>Secure checkout</span></div></div>
        </div>
      </div></div></section>
      <section className="section-tight"><div className="container-wide"><SectionHeading eyebrow="Keep exploring" title="You may also like" description="Similar silhouettes, different energy." />{related.length > 0 ? <div className="product-grid">{related.map((item, index) => <ProductCard key={item.id} product={item} index={index} />)}</div> : <p style={{ color: "var(--muted)" }}>More pairs are arriving soon.</p>}</div></section>
    </>
  );
}
