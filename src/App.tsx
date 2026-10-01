import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Frown } from "lucide-react";
import { useApp } from "./app/AppContext";
import { CustomerShell } from "./components/SiteLayout";
import { PageLoader } from "./components/Ui";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { ProductPageV2 } from "./pages/ProductPageV2";
import { CartPage } from "./pages/CartPage";
import { CheckoutPageFixed } from "./pages/CheckoutPageFixed";
import { AccountPage, OrdersPage, WishlistPage, OrderSuccessPage, StaticPage } from "./pages/AccountPages";
import { StoreVisitPageV2 } from "./pages/StoreVisitPageV2";
import { TrackOrdersPage } from "./pages/TrackOrdersPage";
import { AdminWorkspaceV4 } from "./pages/AdminWorkspaceV4";
import { AdminAccessGate } from "./pages/AdminAccessGate";
const configuredAdminHost=String(import.meta.env.VITE_ADMIN_HOST??"admin.ridershoes.coderiq.in").trim().toLowerCase();
const themeStyles=`
:root{color-scheme:light;--coral:#e94b5b;--coral-dark:#c93647;--ink:#12191b;--ink-soft:#2c3a3e;--paper:#f5f7f5;--paper-card:#ffffff;--muted:#68787d;--line:#dce5e2;--mint:#b8edd9;--blue:#bcdcff}
html[data-color-mode="dark"]{color-scheme:dark;--ink:#f4f7f6;--ink-soft:#d5dfdc;--paper:#0b1113;--paper-card:#141d20;--muted:#aebbb8;--line:#2b393d;--coral:#ff6170;--coral-dark:#e54858;--mint:#77cdb0;--blue:#82b9ed}
@media(prefers-color-scheme:dark){html[data-color-mode="system"]{color-scheme:dark;--ink:#f4f7f6;--ink-soft:#d5dfdc;--paper:#0b1113;--paper-card:#141d20;--muted:#aebbb8;--line:#2b393d;--coral:#ff6170;--coral-dark:#e54858;--mint:#77cdb0;--blue:#82b9ed}}
html,body,#root{min-height:100%;background:var(--paper);color:var(--ink)}
body{margin:0;color:var(--ink);background:var(--paper);transition:background-color .2s ease,color .2s ease}
html[data-color-mode="dark"] body,html[data-color-mode="system"] body{background:var(--paper);color:var(--ink)}
html[data-color-mode="dark"] body *,html[data-color-mode="system"] body *{border-color:var(--line)}
html[data-color-mode="dark"] .site-header,html[data-color-mode="system"] .site-header{background:rgba(11,17,19,.94);border-bottom-color:var(--line);color:var(--ink)}
html[data-color-mode="dark"] .desktop-nav a,html[data-color-mode="system"] .desktop-nav a{color:var(--ink-soft)}
html[data-color-mode="dark"] .section-head h2,html[data-color-mode="system"] .section-head h2,html[data-color-mode="dark"] h1,html[data-color-mode="system"] h1,html[data-color-mode="dark"] h2,html[data-color-mode="system"] h2,html[data-color-mode="dark"] h3,html[data-color-mode="system"] h3,html[data-color-mode="dark"] h4,html[data-color-mode="system"] h4{color:var(--ink)}
html[data-color-mode="dark"] p,html[data-color-mode="system"] p,html[data-color-mode="dark"] li,html[data-color-mode="system"] li,html[data-color-mode="dark"] label,html[data-color-mode="system"] label,html[data-color-mode="dark"] small,html[data-color-mode="system"] small,html[data-color-mode="dark"] span,html[data-color-mode="system"] span{color:inherit}
html[data-color-mode="dark"] .product-card,html[data-color-mode="system"] .product-card,html[data-color-mode="dark"] .glass-card,html[data-color-mode="system"] .glass-card,html[data-color-mode="dark"] .form-card,html[data-color-mode="system"] .form-card,html[data-color-mode="dark"] .summary-card,html[data-color-mode="system"] .summary-card{background:var(--paper-card);border-color:var(--line);color:var(--ink)}
html[data-color-mode="dark"] input,html[data-color-mode="dark"] textarea,html[data-color-mode="dark"] select,html[data-color-mode="system"] input,html[data-color-mode="system"] textarea,html[data-color-mode="system"] select{color:var(--ink);background:var(--paper-card);border-color:var(--line);color-scheme:dark}
html[data-color-mode="dark"] input::placeholder,html[data-color-mode="dark"] textarea::placeholder,html[data-color-mode="system"] input::placeholder,html[data-color-mode="system"] textarea::placeholder{color:#91a09e;opacity:1}
html[data-color-mode="dark"] .button-outline,html[data-color-mode="system"] .button-outline{color:var(--ink);border-color:var(--line);background:transparent}
html[data-color-mode="dark"] .button-outline:hover,html[data-color-mode="system"] .button-outline:hover{border-color:var(--coral);color:var(--coral)}
html[data-color-mode="dark"] .icon-button,html[data-color-mode="system"] .icon-button{color:var(--ink);background:rgba(255,255,255,.06);border-color:var(--line)}
html[data-color-mode="dark"] .count-pill,html[data-color-mode="system"] .count-pill{border-color:var(--paper)}
html[data-color-mode="dark"] .empty-state,html[data-color-mode="system"] .empty-state{background:var(--paper-card)!important;color:var(--ink);border-color:var(--line)!important}
html[data-color-mode="dark"] .product-image-wrap,html[data-color-mode="system"] .product-image-wrap{background:#1b272b}
html[data-color-mode="dark"] .heart-button,html[data-color-mode="system"] .heart-button{background:rgba(255,255,255,.92);color:#172124}
html[data-color-mode="dark"] .toast,html[data-color-mode="system"] .toast{background:var(--paper-card);color:var(--ink);border-color:var(--line)}
html[data-color-mode="dark"] a,html[data-color-mode="system"] a{color:inherit}
html[data-color-mode="dark"] .footer-links a,html[data-color-mode="system"] .footer-links a{color:var(--ink-soft)}
html[data-color-mode="dark"] .announcement,html[data-color-mode="system"] .announcement{background:#070b0c;color:#f4f7f6}
html[data-color-mode="dark"] ::selection,html[data-color-mode="system"] ::selection{color:#071012;background:var(--mint)}
html[data-color-mode="dark"] [style*="background:#fff"],html[data-color-mode="dark"] [style*="background: #fff"],html[data-color-mode="system"] [style*="background:#fff"],html[data-color-mode="system"] [style*="background: #fff"]{background:var(--paper-card)!important;color:var(--ink)!important}
html[data-color-mode="dark"] [style*="background:#ffffff"],html[data-color-mode="dark"] [style*="background: #ffffff"],html[data-color-mode="system"] [style*="background:#ffffff"],html[data-color-mode="system"] [style*="background: #ffffff"]{background:var(--paper-card)!important;color:var(--ink)!important}
html[data-color-mode="dark"] [style*="color:#172124"],html[data-color-mode="dark"] [style*="color:#182528"],html[data-color-mode="system"] [style*="color:#172124"],html[data-color-mode="system"] [style*="color:#182528"]{color:var(--ink)!important}
html[data-color-mode="dark"] .rv,html[data-color-mode="system"] .rv{background:var(--paper);color:var(--ink)}
html[data-color-mode="dark"] .rv-main,html[data-color-mode="system"] .rv-main,html[data-color-mode="dark"] .rv-content,html[data-color-mode="system"] .rv-content{background:var(--paper);color:var(--ink)}
html[data-color-mode="dark"] .rv-card,html[data-color-mode="system"] .rv-card,html[data-color-mode="dark"] .rv-panel,html[data-color-mode="system"] .rv-panel{background:var(--paper-card);color:var(--ink);border-color:var(--line)}
html[data-color-mode="dark"] .rv input,html[data-color-mode="dark"] .rv textarea,html[data-color-mode="dark"] .rv select,html[data-color-mode="system"] .rv input,html[data-color-mode="system"] .rv textarea,html[data-color-mode="system"] .rv select{background:var(--paper-card);color:var(--ink);border-color:var(--line)}
html[data-color-mode="dark"] .rv-side,html[data-color-mode="system"] .rv-side{background:#0b1113;color:#f4f7f6}
html[data-color-mode="dark"] .rv-side a,html[data-color-mode="system"] .rv-side a,html[data-color-mode="dark"] .rv-side button,html[data-color-mode="system"] .rv-side button{color:#cbd6d3}
`;
export function App(){const location=useLocation();const {isLoading,toast,settings}=useApp();const isAdminPath=location.pathname.startsWith("/admin");const currentHostname=typeof window!=="undefined"?window.location.hostname.trim().toLowerCase():"";const isAdminHost=Boolean(configuredAdminHost)&&currentHostname===configuredAdminHost;const adminHostMode=Boolean(configuredAdminHost);useEffect(()=>{const page=location.pathname==="/"?"Move your way":location.pathname.slice(1).replaceAll("/"," · ");document.title=`${page||"Rider Shoes"} — Rider Shoes`},[location.pathname]);useEffect(()=>{document.documentElement.dataset.colorMode=settings.colorMode;return()=>{delete document.documentElement.dataset.colorMode}},[settings.colorMode]);if(adminHostMode&&!isAdminHost&&isAdminPath)return <Navigate to="/" replace/>;if(adminHostMode&&isAdminHost&&!isAdminPath)return <Navigate to="/admin" replace/>;if(isAdminPath)return <><style>{themeStyles}</style><AdminAccessGate><Routes><Route path="/admin/*" element={<AdminWorkspaceV4/>}/></Routes></AdminAccessGate></>;return <><style>{themeStyles}</style><CustomerShell>{toast&&<motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}>{toast}</motion.div>}<AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}}>{isLoading&&location.pathname==="/"?<PageLoader/>:<Routes><Route path="/" element={<HomePage/>}/><Route path="/shop" element={<ShopPage/>}/><Route path="/category/:slug" element={<ShopPage/>}/><Route path="/product/:slug" element={<ProductPageV2/>}/><Route path="/cart" element={<CartPage/>}/><Route path="/checkout" element={<CheckoutPageFixed/>}/><Route path="/order-success" element={<OrderSuccessPage/>}/><Route path="/orders" element={<OrdersPage/>}/><Route path="/track-order" element={<TrackOrdersPage/>}/><Route path="/wishlist" element={<WishlistPage/>}/><Route path="/account" element={<AccountPage/>}/><Route path="/store-visit" element={<StoreVisitPageV2/>}/><Route path="/about" element={<StaticPage kind="about"/>}/><Route path="/contact" element={<StaticPage kind="contact"/>}/><Route path="/offers" element={<StaticPage kind="offers"/>}/><Route path="/privacy" element={<StaticPage kind="privacy"/>}/><Route path="/terms" element={<StaticPage kind="terms"/>}/><Route path="/refund-policy" element={<StaticPage kind="refund"/>}/><Route path="*" element={<NotFoundPage/>}/></Routes>}</motion.div></AnimatePresence></CustomerShell></>}
function NotFoundPage(){return <section className="section"><div className="container-narrow"><div className="empty-state" style={{border:"1px solid var(--line)",borderRadius:25,background:"#fff"}}><Frown size={35}/><div className="eyebrow">404</div><h2>That page took a different route.</h2><p>Let us get you back to the good stuff.</p><div style={{display:"flex",justifyContent:"center",gap:9,flexWrap:"wrap"}}><Link className="button button-primary" to="/">Go home <ArrowRight size={14}/></Link><Link className="button button-outline" to="/shop"><Compass size={14}/> Browse shoes</Link></div></div></div></section>}
