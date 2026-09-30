import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ChevronRight,
  Heart,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { Logo } from "./Ui";

const navigation = [
  ["Shop", "/shop"],
  ["New in", "/shop?sort=new"],
  ["Running", "/category/running"],
  ["Everyday", "/category/everyday"],
  ["Outdoor", "/category/outdoor"],
  ["Visit store", "/store-visit"],
] as const;

const whatsappHref = (phone: string, text: string): string => {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits || "919000000000"}?text=${encodeURIComponent(text)}`;
};

export function SiteHeader() {
  const { settings, cart, wishlist } = useApp();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isDark = location.pathname === "/";
  return (
    <header className={`site-header ${isDark ? "dark" : ""}`}>
      {settings.announcementEnabled && <div className="announcement"><strong>{settings.announcementText}</strong> · Thoughtful footwear for everyday movement</div>}
      <div className="container-wide header-inner">
        <button className="icon-button mobile-menu-button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X size={18} /> : <Menu size={18} />}</button>
        <Logo light={isDark} />
        <nav className={`desktop-nav ${open ? "open" : ""}`} aria-label="Primary navigation">
          {navigation.map(([label, href]) => <NavLink key={href} to={href} className={({ isActive }) => isActive ? "active" : ""} onClick={() => setOpen(false)}>{label}</NavLink>)}
        </nav>
        <div className="header-actions">
          <Link className="icon-button hide-mobile" to="/shop" aria-label="Search products"><Search size={17} /></Link>
          <Link className="icon-button hide-mobile" to="/account" aria-label="Your account"><UserRound size={17} /></Link>
          <Link className="icon-button has-count" to="/wishlist" aria-label="Wishlist"><Heart size={17} />{wishlist.length > 0 && <span className="count-pill">{wishlist.length}</span>}</Link>
          <Link className="icon-button has-count" to="/cart" aria-label="Shopping bag"><ShoppingBag size={17} />{cart.length > 0 && <span className="count-pill">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { settings } = useApp();
  return (
    <footer className="site-footer">
      <div className="container-wide">
        <div className="footer-grid">
          <div>
            <Logo light />
            <p>{settings.description}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              {settings.instagramUrl && <a className="icon-button" href={settings.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={15} /></a>}
              <a className="icon-button" href={`tel:${settings.supportPhone}`} aria-label="Call Rider Shoes"><MessageCircle size={15} /></a>
              <a className="icon-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${settings.addressLine1}, ${settings.city}`)}`} target="_blank" rel="noreferrer" aria-label="Find our store"><MapPin size={15} /></a>
            </div>
          </div>
          <div><h3>Explore</h3><div className="footer-links"><Link to="/shop">All shoes</Link><Link to="/shop?sort=new">New in</Link><Link to="/shop?sort=featured">Featured</Link><Link to="/offers">Offers</Link></div></div>
          <div><h3>Help</h3><div className="footer-links"><Link to="/orders">Track order</Link><Link to="/store-visit">Visit our store</Link><Link to="/contact">Contact</Link><Link to="/refund-policy">Returns</Link></div></div>
          <div><h3>Legal</h3><div className="footer-links"><Link to="/about">Our story</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/admin">Admin portal</Link></div></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.storeName}. Built for every step.</span><span>{settings.city}, {settings.state} · {settings.storeHours}</span></div>
      </div>
    </footer>
  );
}

export function StoreContactBar() {
  const { settings } = useApp();
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 15, color: "var(--muted)", fontSize: ".72rem" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin size={14} color="var(--coral)" />{settings.city}, {settings.state}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={14} color="var(--coral)" />{settings.supportPhone}</span></div>;
}

export function FloatingWhatsApp() {
  const { settings } = useApp();
  if (!settings.supportWhatsappEnabled && !settings.supportWhatsappNumber) return null;
  return <a className="floating-whatsapp" href={whatsappHref(settings.supportWhatsappNumber || settings.supportPhone, `Hello ${settings.storeName}, I need help with a pair of shoes.`)} target="_blank" rel="noreferrer" aria-label="Chat with Rider Shoes on WhatsApp"><MessageCircle size={25} /></a>;
}

export function Breadcrumbs({ current }: { current: string }) {
  return <div className="container-wide" style={{ paddingTop: 20, color: "var(--muted)", fontSize: ".7rem", display: "flex", alignItems: "center", gap: 7 }}><Link to="/">Home</Link><ChevronRight size={13} />{current}</div>;
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  return <div className="page-shell"><SiteHeader />{children}<FloatingWhatsApp /><SiteFooter /></div>;
}
