import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AdminWorkspace } from "./AdminWorkspace";

export function AdminPolishedWorkspace(){
  return <>
    <AdminWorkspace/>
    <Link to="/admin/users" className="rw-users-link"><ShieldCheck size={15}/> Users & Roles</Link>
    <style>{`
      /* Rider Shoes Admin — glass command center */
      .rw{
        --glass-bg:rgba(255,255,255,.72);
        --glass-strong:rgba(255,255,255,.88);
        --glass-line:rgba(255,255,255,.72);
        --ink:#162326;
        --muted:#708083;
        --accent:#ef6b4f;
        position:relative!important;
        min-height:100dvh!important;
        overflow-x:hidden!important;
        background:
          radial-gradient(circle at 78% -8%,rgba(239,107,79,.16),transparent 28%),
          radial-gradient(circle at 5% 20%,rgba(116,171,163,.12),transparent 25%),
          linear-gradient(135deg,#edf3f1 0%,#f8faf9 48%,#eef4f2 100%)!important;
        color:var(--ink)!important;
      }
      .rw-side{
        width:250px!important;
        padding:20px 14px!important;
        background:linear-gradient(180deg,rgba(10,21,23,.96),rgba(16,31,34,.94))!important;
        border-right:1px solid rgba(255,255,255,.10)!important;
        box-shadow:16px 0 50px rgba(10,25,28,.14)!important;
        backdrop-filter:blur(22px)!important;
        -webkit-backdrop-filter:blur(22px)!important;
      }
      .rw-logo{padding:4px 8px 22px!important;margin-bottom:17px!important;border-bottom:1px solid rgba(255,255,255,.08)!important}
      .rw-side>small{display:block!important;padding:0 12px 9px!important;color:#728285!important;font-size:9px!important;letter-spacing:.19em!important;font-weight:800!important}
      .rw-side>button{width:100%!important;min-height:44px!important;margin:3px 0!important;padding:0 12px!important;display:flex!important;align-items:center!important;gap:11px!important;border:1px solid transparent!important;border-radius:13px!important;background:transparent!important;color:#91a1a3!important;font-size:11px!important;font-weight:750!important;transition:.18s ease!important}
      .rw-side>button.active{background:linear-gradient(135deg,#f1785e,#e85d48)!important;color:#fff!important;border-color:rgba(255,255,255,.14)!important;box-shadow:0 12px 28px rgba(239,107,79,.22)!important}
      .rw-side>button:hover:not(.active){background:rgba(255,255,255,.075)!important;color:#fff!important;transform:translateX(2px)!important}
      .rw-bottom{margin-top:18px!important;padding-top:14px!important;border-top:1px solid rgba(255,255,255,.08)!important}
      .rw-bottom a,.rw-bottom button{min-height:42px!important;border-radius:12px!important;color:#8fa0a2!important;font-size:10.5px!important}
      .rw-bottom a:hover,.rw-bottom button:hover{background:rgba(255,255,255,.07)!important;color:#fff!important}

      .rw-main{margin-left:250px!important;width:calc(100% - 250px)!important;min-width:0!important;background:transparent!important}
      .rw-main>header{
        height:78px!important;padding:0 30px!important;gap:14px!important;
        background:rgba(248,251,250,.62)!important;
        border-bottom:1px solid rgba(255,255,255,.78)!important;
        box-shadow:0 8px 35px rgba(22,39,42,.045)!important;
        backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;
        position:sticky!important;top:0!important;z-index:80!important;
      }
      .rw-main header small{color:#809092!important;font-size:8px!important;letter-spacing:.16em!important;font-weight:850!important}
      .rw-main header h1{margin-top:3px!important;font-size:20px!important;letter-spacing:-.025em!important;color:#172528!important}
      .rw-owner{margin-left:auto!important;padding:7px 11px!important;border:1px solid rgba(255,255,255,.85)!important;border-radius:999px!important;background:rgba(255,255,255,.62)!important;color:#4c6563!important;font-size:9px!important;box-shadow:0 5px 16px rgba(25,45,47,.05)!important}
      .rw-menu{display:none!important}
      .rw-main main{width:100%!important;max-width:1560px!important;margin:0 auto!important;padding:30px 30px 70px!important}

      .rw-head{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:20px!important;margin-bottom:22px!important}
      .rw-head small{color:#819091!important;font-size:8px!important;letter-spacing:.18em!important;font-weight:850!important}
      .rw-head h2{margin:5px 0 4px!important;font-size:31px!important;line-height:1.05!important;letter-spacing:-.045em!important;color:#172628!important}
      .rw-head p{margin:0!important;color:#718083!important;font-size:12px!important}

      .rw-metrics{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;margin-bottom:16px!important}
      .rw-metric,.rw-card{
        border:1px solid var(--glass-line)!important;
        background:var(--glass-bg)!important;
        box-shadow:0 18px 50px rgba(26,48,51,.065),inset 0 1px 0 rgba(255,255,255,.8)!important;
        backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;
      }
      .rw-metric{min-height:112px!important;padding:20px!important;border-radius:20px!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important}
      .rw-metric span{font-size:10px!important;color:#718083!important;font-weight:700!important}
      .rw-metric strong{font-size:28px!important;letter-spacing:-.035em!important;color:#17282b!important}
      .rw-card{border-radius:21px!important;padding:20px!important;margin-bottom:16px!important}
      .rw-card h3{margin:0 0 15px!important;font-size:14px!important;color:#203033!important;letter-spacing:-.01em!important}
      .rw-two{display:grid!important;grid-template-columns:minmax(0,1.45fr) minmax(300px,.8fr)!important;gap:16px!important}
      .rw-row{display:flex!important;justify-content:space-between!important;align-items:center!important;padding:12px 0!important;border-bottom:1px solid rgba(112,128,131,.11)!important;font-size:11px!important}
      .rw-muted{color:#819092!important;font-size:11px!important}
      .rw-link{border:0!important;background:transparent!important;color:#df604b!important;font-size:10px!important;font-weight:800!important;padding:8px 0!important}
      .rw-primary{display:inline-flex!important;align-items:center!important;gap:7px!important;border:1px solid rgba(255,255,255,.6)!important;border-radius:13px!important;padding:11px 15px!important;background:linear-gradient(135deg,#f2765c,#e85d48)!important;color:#fff!important;font-size:10px!important;font-weight:850!important;box-shadow:0 12px 25px rgba(239,107,79,.18)!important}
      .rw-secondary{border-radius:12px!important}
      .rw-search{width:100%!important;min-height:44px!important;border:1px solid rgba(203,216,213,.75)!important;border-radius:13px!important;background:rgba(255,255,255,.65)!important;box-shadow:inset 0 1px 2px rgba(30,50,52,.025)!important;padding:0 13px!important;color:#203033!important}
      .rw-table{width:100%!important;overflow-x:auto!important;border:1px solid rgba(211,222,220,.72)!important;border-radius:15px!important;background:rgba(255,255,255,.35)!important}
      .rw-table table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;font-size:11px!important}
      .rw-table th{background:rgba(237,244,242,.62)!important;color:#718083!important;font-size:9px!important;letter-spacing:.06em!important;text-transform:uppercase!important;padding:12px 11px!important}
      .rw-table td{padding:13px 11px!important;border-top:1px solid rgba(112,128,131,.09)!important;color:#26383b!important}
      .rw-product{display:flex!important;align-items:center!important;gap:9px!important}.rw-product img{width:42px!important;height:42px!important;object-fit:cover!important;border-radius:11px!important;background:#edf2f0!important}.rw-product b{font-size:10.5px!important}.rw-product small{display:block!important;color:#899799!important;margin-top:3px!important;font-size:8px!important}
      .rw-pill{display:inline-flex!important;padding:5px 8px!important;border-radius:999px!important;background:rgba(229,239,236,.85)!important;color:#55716c!important;font-size:8px!important;font-weight:800!important}
      .rw-icon{border:1px solid rgba(205,217,214,.8)!important;background:rgba(255,255,255,.62)!important;border-radius:9px!important;padding:7px!important;margin-left:4px!important;color:#526668!important}.rw-icon.danger{color:#d65e4c!important}
      .rw-editor{display:grid!important;grid-template-columns:minmax(250px,.65fr) minmax(0,1.35fr)!important;gap:22px!important}
      .rw-upload{border:1px dashed rgba(160,181,177,.9)!important;border-radius:18px!important;padding:17px!important;background:rgba(245,250,248,.64)!important}
      .rw-upload label{display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;margin-top:12px!important;border:1px solid rgba(207,220,217,.8)!important;background:rgba(255,255,255,.72)!important;border-radius:12px!important;padding:11px!important;color:#415b59!important;font-size:10px!important;font-weight:800!important}
      .rw-upload small{display:block!important;margin-top:9px!important;color:#829092!important;font-size:8.5px!important;line-height:1.45!important}
      .rw-photos{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}.rw-photos img{width:100%!important;aspect-ratio:1!important;object-fit:cover!important;border-radius:11px!important;border:1px solid rgba(220,229,227,.8)!important;background:#edf2f0!important}
      .rw-settings{grid-template-columns:210px minmax(0,1fr)!important;gap:18px!important}.rw-settings>nav{background:rgba(255,255,255,.52)!important;border:1px solid rgba(255,255,255,.8)!important;border-radius:17px!important;padding:8px!important;box-shadow:0 12px 28px rgba(24,44,47,.06)!important}.rw-settings>nav button{border-radius:11px!important;padding:12px!important;font-size:10px!important}.rw-settings>nav button.active{background:linear-gradient(135deg,#24383a,#18282a)!important}
      .field input,.field select,.field textarea{border:1px solid rgba(202,216,213,.85)!important;background:rgba(255,255,255,.68)!important;color:#17282b!important;border-radius:12px!important;min-height:43px!important;box-shadow:inset 0 1px 2px rgba(20,40,42,.025)!important}
      .field input:focus,.field select:focus,.field textarea:focus{outline:none!important;border-color:rgba(239,107,79,.65)!important;box-shadow:0 0 0 3px rgba(239,107,79,.10)!important}

      .rw-users-link{position:fixed!important;right:22px!important;top:17px!important;z-index:100!important;display:inline-flex!important;align-items:center!important;gap:7px!important;padding:9px 12px!important;border:1px solid rgba(255,255,255,.72)!important;border-radius:999px!important;background:rgba(24,40,42,.86)!important;color:#fff!important;text-decoration:none!important;font-size:9px!important;font-weight:850!important;box-shadow:0 10px 26px rgba(20,38,40,.18)!important;backdrop-filter:blur(15px)!important}
      .rw-users-link:hover{background:#ef6b4f!important;transform:translateY(-1px)!important}

      .admin-login{min-height:100dvh!important;display:grid!important;place-items:center!important;padding:22px!important;background:radial-gradient(circle at 78% 12%,rgba(239,107,79,.22),transparent 30%),radial-gradient(circle at 15% 90%,rgba(92,137,132,.17),transparent 30%),linear-gradient(135deg,#071012,#101c1e 55%,#0a1214)!important}
      .admin-login-card{width:min(430px,100%)!important;padding:32px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:28px!important;background:rgba(255,255,255,.075)!important;box-shadow:0 30px 90px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.13)!important;backdrop-filter:blur(28px)!important;-webkit-backdrop-filter:blur(28px)!important;color:#fff!important}
      .admin-login-card .field input{background:rgba(255,255,255,.105)!important;color:#fff!important;border:1px solid rgba(255,255,255,.20)!important}.admin-login-card .field input:focus{background:rgba(255,255,255,.15)!important;border-color:#ef6b4f!important;box-shadow:0 0 0 3px rgba(239,107,79,.15)!important}.admin-login-card .field input:-webkit-autofill{-webkit-text-fill-color:#fff!important;box-shadow:0 0 0 1000px rgba(255,255,255,.11) inset!important}
      .admin-secure-badge{display:inline-flex!important;align-items:center!important;gap:6px!important;margin:12px 0 4px!important;padding:6px 9px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:999px!important;color:rgba(255,255,255,.72)!important;font-size:8px!important;font-weight:850!important;letter-spacing:.08em!important}.admin-session-note{display:block!important;margin-top:12px!important;color:rgba(255,255,255,.42)!important;font-size:8.5px!important;line-height:1.5!important}

      @media(min-width:901px){.rw-side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;z-index:120!important;overflow-y:auto!important}.rw-main{min-height:100dvh!important}}
      @media(max-width:900px){
        .rw-side{width:min(305px,86vw)!important;position:fixed!important;left:0!important;top:0!important;bottom:0!important;z-index:140!important;transform:translateX(-105%)!important;transition:transform .22s ease!important;overflow-y:auto!important}
        .rw-side.open{transform:translateX(0)!important;box-shadow:20px 0 60px rgba(0,0,0,.34)!important}
        .rw:has(.rw-side.open)::before{content:""!important;position:fixed!important;inset:0!important;background:rgba(4,11,13,.58)!important;backdrop-filter:blur(4px)!important;z-index:130!important}
        .rw-main{margin-left:0!important;width:100%!important}.rw-main>header{height:68px!important;padding:0 14px!important;position:sticky!important;z-index:90!important}.rw-menu{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;flex:0 0 40px!important;border:1px solid rgba(210,222,219,.85)!important;border-radius:12px!important;background:rgba(255,255,255,.72)!important;color:#1b2c2f!important}.rw-main main{padding:20px 13px 48px!important}.rw-head{align-items:flex-start!important;flex-wrap:wrap!important}.rw-head>div{flex:1 1 180px!important;min-width:0!important}.rw-head h2{font-size:26px!important}.rw-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}.rw-two{grid-template-columns:1fr!important}.rw-card{padding:15px!important;border-radius:17px!important}.rw-table{overflow-x:auto!important}.rw-table table{min-width:650px!important}.rw-editor{grid-template-columns:1fr!important}.rw-settings{grid-template-columns:1fr!important}.rw-settings>nav{display:flex!important;overflow-x:auto!important;gap:5px!important}.rw-settings>nav button{white-space:nowrap!important;flex:0 0 auto!important}.rw-users-link{right:10px!important;top:10px!important}.rw-main>header{padding-right:125px!important}
      }
      @media(max-width:520px){.rw-metrics{grid-template-columns:1fr!important}.rw-metric{min-height:92px!important}.rw-metric strong{font-size:24px!important}.rw-users-link{right:8px!important;top:8px!important;padding:8px 10px!important}.rw-main>header{padding-right:118px!important}.rw-main header h1{font-size:18px!important}.rw-owner{display:none!important}.rw-head h2{font-size:24px!important}.rw-photos{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    `}</style>
  </>;
}
