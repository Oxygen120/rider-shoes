import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Frown } from "lucide-react";
import { useApp } from "./app/AppContext";
import { useAuth } from "./app/AuthContext";
import { CustomerShell } from "./components/SiteLayout";
import { PageLoader } from "./components/Ui";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPageFixed } from "./pages/CheckoutPageFixed";
import { OrderSuccessPage, StaticPage } from "./pages/AccountPages";
import { StoreVisitPageV2 } from "./pages/StoreVisitPageV2";
import { AdminPolishedWorkspace } from "./pages/AdminPolishedWorkspace";
import { AdminUsersPage } from "./pages/AdminUsersPage";

const configuredAdminHost = String(import.meta.env.VITE_ADMIN_HOST ?? "").trim().toLowerCase();

export function App(){
  const location=useLocation();
  const {isLoading,toast}=useApp();
  const {user,accessVerified,loading:authLoading}=useAuth();
  const isAdminPath=location.pathname.startsWith("/admin");
  const isAdminHost=Boolean(configuredAdminHost)&&location.hostname.toLowerCase()===configuredAdminHost;
  const adminHostMode=Boolean(configuredAdminHost);

  useEffect(()=>{
    const page=location.pathname==="/"?"Move your way":location.pathname.slice(1).replaceAll("/"," · ");
    document.title=`${page||"Rider Shoes"} — Rider Shoes`;
  },[location.pathname]);

  /* When VITE_ADMIN_HOST is configured, the public storefront can never render
     an admin route and the admin hostname can never render customer pages. */
  if(adminHostMode && !isAdminHost && isAdminPath) return <Navigate to="/" replace/>;
  if(adminHostMode && isAdminHost && !isAdminPath) return <AdminEntry loading={authLoading} user={user} accessVerified={accessVerified}/>;

  if(isAdminPath) return <Routes>
    <Route path="/admin/users" element={<AdminUsersPage/>}/>
    <Route path="/admin/*" element={<AdminPolishedWorkspace/>}/>
  </Routes>;

  return <CustomerShell>
    {toast&&<motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}>{toast}</motion.div>}
    <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}}>
      {isLoading&&location.pathname==="/"?<PageLoader/>:<Routes>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/shop" element={<ShopPage/>}/>
        <Route path="/category/:slug" element={<ShopPage/>}/>
        <Route path="/product/:slug" element={<ProductPage/>}/>
        <Route path="/cart" element={<CartPage/>}/>
        <Route path="/checkout" element={<CheckoutPageFixed/>}/>
        <Route path="/order-success" element={<OrderSuccessPage/>}/>
        <Route path="/store-visit" element={<StoreVisitPageV2/>}/>
        <Route path="/about" element={<StaticPage kind="about"/>}/>
        <Route path="/contact" element={<StaticPage kind="contact"/>}/>
        <Route path="/offers" element={<StaticPage kind="offers"/>}/>
        <Route path="/privacy" element={<StaticPage kind="privacy"/>}/>
        <Route path="/terms" element={<StaticPage kind="terms"/>}/>
        <Route path="/refund-policy" element={<StaticPage kind="refund"/>}/>
        <Route path="*" element={<NotFoundPage/>}/>
      </Routes>}
    </motion.div></AnimatePresence>
  </CustomerShell>
}

function AdminEntry({loading,user,accessVerified}:{loading:boolean;user:ReturnType<typeof useAuth>["user"];accessVerified:boolean}){
  if(loading) return <div className="admin-login"><div className="admin-login-card"><h1>Verifying access…</h1><p>Checking your secure Rider Shoes admin session.</p></div></div>;
  if(!user||!accessVerified) return <Navigate to="/admin" replace/>;
  return <AdminPolishedWorkspace/>;
}

function NotFoundPage(){return <section className="section"><div className="container-narrow"><div className="empty-state" style={{border:"1px solid var(--line)",borderRadius:25,background:"#fff"}}><Frown size={35}/><div className="eyebrow">404</div><h2>That page took a different route.</h2><p>Let us get you back to the good stuff.</p><div style={{display:"flex",justifyContent:"center",gap:9,flexWrap:"wrap"}}><Link className="button button-primary" to="/">Go home <ArrowRight size={14}/></Link><Link className="button button-outline" to="/shop"><Compass size={14}/> Browse shoes</Link></div></div></div></section>}