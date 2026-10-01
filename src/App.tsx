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
:root{color-scheme:dark;--coral:#ff6170;--coral-dark:#e54858;--ink:#f5f7f6;--ink-soft:#d5dfdc;--paper:#080d0f;--paper-card:rgba(20,29,32,.82);--muted:#aebbb8;--line:rgba(255,255,255,.12);--mint:#77cdb0;--blue:#82b9ed;--glass:rgba(255,255,255,.055)}
html,body,#root{min-height:100%;background:var(--paper)!important;color:var(--ink)!important;color-scheme:dark}
html{background:#080d0f!important}
body{margin:0;background:radial-gradient(circle at 15% 0%,rgba(119,205,176,.08),transparent 28%),radial-gradient(circle at 90% 10%,rgba(130,185,237,.07),transparent 26%),var(--paper)!important;color:var(--ink)!important}
body *{border-color:var(--line)}
h1,h2,h3,h4,h5,h6,strong,b{color:var(--ink)}
p,li,label,small{color:var(--ink-soft)}
a{color:inherit}
input,textarea,select{color:var(--ink)!important;background:rgba(20,29,32,.9)!important;border:1px solid var(--line)!important;color-scheme:dark}
input::placeholder,textarea::placeholder{color:#879793!important;opacity:1}
button,.button{color:var(--ink)}
.site-header{background:rgba(8,13,15,.78)!important;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--line)!important;color:var(--ink)!important}
.desktop-nav a{color:var(--ink-soft)!important}
.section-head h2,h1,h2,h3,h4{color:var(--ink)!important}
.product-card,.glass-card,.form-card,.summary-card,.empty-state,.rv-card,.rv-panel{background:var(--paper-card)!important;color:var(--ink)!important;border:1px solid var(--line)!important;box-shadow:0 18px 50px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.045);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.product-image-wrap{background:rgba(255,255,255,.045)!important}
.button-primary{background:linear-gradient(135deg,#ff6170,#e54858)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 10px 28px rgba(229,72,88,.22)}
.button-outline{background:rgba(255,255,255,.045)!important;color:var(--ink)!important;border-color:var(--line)!important}
.button-outline:hover{border-color:var(--coral)!important;color:var(--coral)!important;background:rgba(255,97,112,.07)!important}
.icon-button{background:rgba(255,255,255,.06)!important;color:var(--ink)!important;border-color:var(--line)!important}
.toast{background:rgba(20,29,32,.94)!important;color:var(--ink)!important;border:1px solid var(--line)!important;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.announcement{background:rgba(5,9,10,.88)!important;color:var(--ink)!important}
.footer-links a{color:var(--ink-soft)!important}
.empty-state{background:var(--paper-card)!important}
.heart-button{background:rgba(255,255,255,.9)!important;color:#172124!important}
.count-pill{border-color:var(--line)!important}
::selection{background:var(--mint);color:#071012}
.rv,.rv-main,.rv-content{background:transparent!important;color:var(--ink)!important}
.rv-card,.rv-panel{background:var(--paper-card)!important}
.rv-side{background:rgba(5,9,10,.9)!important;color:var(--ink)!important}
.rv-side a,.rv-side button{color:var(--ink-soft)!important}
[style*="background:#fff"],[style*="background: #fff"],[style*="background:#ffffff"],[style*="background: #ffffff"]{background:var(--paper-card)!important;color:var(--ink)!important}
[style*="color:#172124"],[style*="color:#182528"]{color:var(--ink)!important}
`;
export function App(){const location=useLocation();const {isLoading,toast}=useApp();const isAdminPath=location.pathname.startsWith("/admin");const currentHostname=typeof window!=="undefined"?window.location.hostname.trim().toLowerCase():"";const isAdminHost=Boolean(configuredAdminHost)&&currentHostname===configuredAdminHost;const adminHostMode=Boolean(configuredAdminHost);useEffect(()=>{const page=location.pathname==="/"?"Move your way":location.pathname.slice(1).replaceAll("/"," · ");document.title=`${page||"Rider Shoes"} — Rider Shoes`},[location.pathname]);useEffect(()=>{document.documentElement.dataset.colorMode="dark"},[]);if(adminHostMode&&!isAdminHost&&isAdminPath)return <Navigate to="/" replace/>;if(adminHostMode&&isAdminHost&&!isAdminPath)return <Navigate to="/admin" replace/>;if(isAdminPath)return <><style>{themeStyles}</style><AdminAccessGate><Routes><Route path="/admin/*" element={<AdminWorkspaceV4/>}/></Routes></AdminAccessGate></>;return <><style>{themeStyles}</style><CustomerShell>{toast&&<motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}>{toast}</motion.div>}<AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}}>{isLoading&&location.pathname==="/"?<PageLoader/>:<Routes><Route path="/" element={<HomePage/>}/><Route path="/shop" element={<ShopPage/>}/><Route path="/category/:slug" element={<ShopPage/>}/><Route path="/product/:slug" element={<ProductPageV2/>}/><Route path="/cart" element={<CartPage/>}/><Route path="/checkout" element={<CheckoutPageFixed/>}/><Route path="/order-success" element={<OrderSuccessPage/>}/><Route path="/orders" element={<OrdersPage/>}/><Route path="/track-order" element={<TrackOrdersPage/>}/><Route path="/wishlist" element={<WishlistPage/>}/><Route path="/account" element={<AccountPage/>}/><Route path="/store-visit" element={<StoreVisitPageV2/>}/><Route path="/about" element={<StaticPage kind="about"/>}/><Route path="/contact" element={<StaticPage kind="contact"/>}/><Route path="/offers" element={<StaticPage kind="offers"/>}/><Route path="/privacy" element={<StaticPage kind="privacy"/>}/><Route path="/terms" element={<StaticPage kind="terms"/>}/><Route path="/refund-policy" element={<StaticPage kind="refund"/>}/><Route path="*" element={<NotFoundPage/>}/></Routes>}</motion.div></AnimatePresence></CustomerShell></>}
function NotFoundPage(){return <section className="section"><div className="container-narrow"><div className="empty-state" style={{border:"1px solid var(--line)",borderRadius:25,background:"#fff"}}><Frown size={35}/><div className="eyebrow">404</div><h2>That page took a different route.</h2><p>Let us get you back to the good stuff.</p><div style={{display:"flex",justifyContent:"center",gap:9,flexWrap:"wrap"}}><Link className="button button-primary" to="/">Go home <ArrowRight size={14}/></Link><Link className="button button-outline" to="/shop"><Compass size={14}/> Browse shoes</Link></div></div></div></section>}
