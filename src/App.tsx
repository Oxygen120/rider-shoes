import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Frown } from "lucide-react";
import { useApp } from "./app/AppContext";
import { CustomerShell } from "./components/SiteLayout";
import { PageLoader } from "./components/Ui";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPageFixed } from "./pages/CheckoutPageFixed";
import { AccountPage, OrderSuccessPage, OrdersPage, StaticPage, StoreVisitPage, WishlistPage } from "./pages/AccountPages";
import { AdminWorkspace } from "./pages/AdminWorkspace";

export function App(){const location=useLocation();const {isLoading,toast}=useApp();const isAdmin=location.pathname.startsWith("/admin");useEffect(()=>{const page=location.pathname==="/"?"Move your way":location.pathname.slice(1).replaceAll("/"," · ");document.title=`${page||"Rider Shoes"} — Rider Shoes`},[location.pathname]);if(isAdmin)return <Routes><Route path="/admin/*" element={<AdminWorkspace/>}/></Routes>;return <CustomerShell>{toast&&<motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}>{toast}</motion.div>}<AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}}>{isLoading&&location.pathname==="/"?<PageLoader/>:<Routes><Route path="/" element={<HomePage/>}/><Route path="/shop" element={<ShopPage/>}/><Route path="/category/:slug" element={<ShopPage/>}/><Route path="/product/:slug" element={<ProductPage/>}/><Route path="/cart" element={<CartPage/>}/><Route path="/checkout" element={<CheckoutPageFixed/>}/><Route path="/order-success" element={<OrderSuccessPage/>}/><Route path="/orders" element={<OrdersPage/>}/><Route path="/wishlist" element={<WishlistPage/>}/><Route path="/account" element={<AccountPage/>}/><Route path="/store-visit" element={<StoreVisitPage/>}/><Route path="/about" element={<StaticPage kind="about"/>}/><Route path="/contact" element={<StaticPage kind="contact"/>}/><Route path="/offers" element={<StaticPage kind="offers"/>}/><Route path="/privacy" element={<StaticPage kind="privacy"/>}/><Route path="/terms" element={<StaticPage kind="terms"/>}/><Route path="/refund-policy" element={<StaticPage kind="refund"/>}/><Route path="*" element={<NotFoundPage/>}/></Routes>}</motion.div></AnimatePresence></CustomerShell>}
function NotFoundPage(){return <section className="section"><div className="container-narrow"><div className="empty-state" style={{border:"1px solid var(--line)",borderRadius:25,background:"#fff"}}><Frown size={35}/><div className="eyebrow">404</div><h2>That page took a different route.</h2><p>Let us get you back to the good stuff.</p><div style={{display:"flex",justifyContent:"center",gap:9,flexWrap:"wrap"}}><Link className="button button-primary" to="/">Go home <ArrowRight size={14}/></Link><Link className="button button-outline" to="/shop"><Compass size={14}/> Browse shoes</Link></div></div></div></section>}
