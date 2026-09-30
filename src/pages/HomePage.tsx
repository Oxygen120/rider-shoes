import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Bike,
  CircleUserRound,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../app/AppContext";
import { CategoryCard, ProductCard, Reveal, SectionHeading, TrustCard } from "../components/Ui";
import { StoreContactBar } from "../components/SiteLayout";

export function HomePage() {
  const { products, categories, settings } = useApp();
  const heroProduct = products[0];
  const featured = products.filter((product) => product.featured).slice(0, 4);
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <motion.div className="hero-copy" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
            <div className="eyebrow">Rider Shoes · Dhanera</div>
            <h1 className="display-title">{settings.heroTitle.split(" ").map((word, index) => <span key={`${word}-${index}`} className={index % 4 === 2 ? "accent" : ""}>{word}{index < settings.heroTitle.split(" ").length - 1 ? " " : ""}</span>)}</h1>
            <p>{settings.heroSubtitle}</p>
            <div className="hero-actions"><Link to="/shop" className="button button-light">Shop collection <ArrowRight size={16} /></Link><Link to="/store-visit" className="button button-dark">Visit our store <MapPin size={15} /></Link></div>
            <div className="hero-meta"><span><MapPin size={14} />{settings.city}</span><span><CircleUserRound size={14} />{settings.supportPhone}</span></div>
          </motion.div>
          <motion.div className="hero-art" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: .12 }}>
            <div className="hero-glow" /><div className="hero-ring" /><div className="hero-orbit" />
            {heroProduct && <div className="hero-shoe"><img src={heroProduct.imageUrl} alt={`${heroProduct.name} floating product visual`} /></div>}
            <div className="hero-scroll"><ArrowDownRight size={13} /> Scroll to explore</div>
          </motion.div>
        </div>
      </section>

      <main>
        <section className="section-tight"><div className="container-wide"><div className="trust-grid"><TrustCard icon={BadgeCheck} title="100% original" text="Thoughtful materials and honest product details." /><TrustCard icon={ShieldCheck} title="Secure checkout" text="Protected payments with COD where available." /><TrustCard icon={Bike} title="Fast delivery" text={`${settings.deliveryEstimate} to serviceable areas.`} /><TrustCard icon={Sparkles} title="Visit & save" text="Register a store visit for an extra discount." /></div></div></section>

        <section className="section"><div className="container-wide"><SectionHeading eyebrow="Curated for movement" title="Shop by rhythm" description="Build a rotation for every version of your day — from first light runs to slow Sunday walks." action={<Link to="/shop" className="button button-outline button-small">View all <ArrowRight size={13} /></Link>} /><div className="category-grid">{categories.slice(0, 5).map((category, index) => <CategoryCard key={category.id} category={category} index={index} />)}</div></div></section>

        <section className="section dark-panel"><div className="container-wide"><SectionHeading eyebrow="The edit" title="Featured for the week" description="A considered lineup of easy-to-wear silhouettes, tuned for comfort and built to keep up." action={<Link to="/shop?sort=featured" className="button button-dark button-small">Shop featured <ArrowRight size={13} /></Link>} /><div className="product-grid">{(featured.length ? featured : products.slice(0, 4)).map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div></div></section>

        <section className="section"><div className="container-wide"><div className="editorial-banner"><div className="editorial-copy"><div className="eyebrow">Make time for the in-person fit</div><h2 className="display-title">Visit our store.<br /><span style={{ color: "var(--coral)" }}>Get extra.</span></h2><p>Try your shortlist, meet the people behind Rider Shoes, and unlock a store-only discount when you register your visit.</p><div className="editorial-list"><span><CircleUserRound size={15} /> Register your visit</span><span><ShoppingBag size={15} /> Pick your favourites</span><span><Sparkles size={15} /> Get an exclusive offer</span></div><Link to="/store-visit" className="button button-light">Register now <ArrowRight size={15} /></Link></div></div></div></section>

        <section className="section-tight"><div className="container-wide" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}><div><div className="eyebrow">Come say hello</div><h2 className="display-title" style={{ margin: "8px 0 12px", fontSize: "2rem" }}>Made for your next step.</h2><StoreContactBar /></div><Link to="/contact" className="button button-primary">Talk to the team <ArrowRight size={15} /></Link></div></section>
      </main>
    </>
  );
}
