import { AdminWorkspace } from "./AdminWorkspace";

/** Visual layer for the admin workspace. Functional controls remain in AdminWorkspace. */
export function AdminPolishedWorkspace() {
  return <>
    <AdminWorkspace />
    <style>{`
      .rw{background:radial-gradient(circle at 85% -10%,rgba(239,107,79,.09),transparent 32%),#f3f6f5!important}
      .rw-side{width:272px!important;padding:24px 16px!important;background:linear-gradient(180deg,#0d1517 0%,#121d20 55%,#0b1214 100%)!important;box-shadow:10px 0 35px rgba(15,25,28,.10)!important}
      .rw-logo{padding:2px 9px 28px!important;border-bottom:1px solid rgba(255,255,255,.07)!important;margin-bottom:18px!important}
      .rw-side>small{font-size:9px!important;letter-spacing:.18em!important;color:#718083!important;padding:0 12px 9px!important}
      .rw-side>button{min-height:42px!important;margin:2px 0!important;padding:0 13px!important;border-radius:11px!important;font-size:11px!important;font-weight:700!important;transition:all .18s ease!important}
      .rw-side>button.active{background:linear-gradient(135deg,#ef6b4f,#e65d47)!important;color:#fff!important;box-shadow:0 8px 20px rgba(239,107,79,.18)!important}
      .rw-side>button:hover:not(.active){background:rgba(255,255,255,.07)!important;color:#fff!important;transform:translateX(2px)!important}
      .rw-bottom{border-top:1px solid rgba(255,255,255,.07)!important;padding-top:13px!important;margin-top:18px!important}
      .rw-bottom a,.rw-bottom button{min-height:40px!important;border-radius:10px!important;font-size:11px!important}
      .rw-main{margin-left:272px!important}
      .rw-main>header{height:82px!important;padding:0 34px!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(16px)!important;box-shadow:0 1px 0 rgba(20,35,38,.05)!important}
      .rw-main header h1{font-size:22px!important;letter-spacing:-.02em!important}
      .rw-owner{padding:7px 11px!important;border:1px solid #dce5e3!important;border-radius:99px!important;background:#f5f8f7!important;color:#48615d!important}
      .rw-main main{max-width:1500px!important;padding:32px 34px 70px!important}
      .rw-head{margin-bottom:24px!important}
      .rw-head h2{font-size:30px!important;letter-spacing:-.03em!important}
      .rw-card{border-radius:17px!important;padding:22px!important;border-color:#dde6e4!important;box-shadow:0 8px 30px rgba(21,39,42,.045)!important}
      .rw-card h3{font-size:15px!important}
      .rw-metrics{gap:14px!important}
      .rw-metric{border-radius:16px!important;padding:19px!important;box-shadow:0 7px 24px rgba(21,39,42,.04)!important}
      .rw-metric strong{font-size:23px!important}
      .rw-table table{font-size:11.5px!important}
      .rw-table th{padding:11px 10px!important}
      .rw-table td{padding:13px 10px!important}
      .rw-primary{border-radius:10px!important;padding:11px 15px!important;box-shadow:0 7px 16px rgba(239,107,79,.13)!important}
      .rw-secondary{border-radius:10px!important}
      .rw-search{min-height:42px!important;border-radius:10px!important;background:#fbfcfc!important}
      .rw-editor{gap:22px!important}
      .rw-upload{border:1px dashed #b9c8c5!important;background:linear-gradient(180deg,#fbfdfc,#f4f8f7)!important;border-radius:15px!important;padding:17px!important}
      .rw-upload label{background:#fff!important;border-radius:9px!important;padding:10px 12px!important}
      .rw-settings{grid-template-columns:210px 1fr!important;gap:18px!important}
      .rw-settings>nav{border-radius:15px!important;padding:9px!important;box-shadow:0 7px 22px rgba(21,39,42,.08)!important}
      .rw-settings>nav button{padding:12px!important;border-radius:9px!important;font-size:10.5px!important}
      .rw-settings>nav button.active{background:linear-gradient(135deg,#273638,#1d292b)!important}
      .field input,.field select{min-height:42px!important;border-radius:10px!important;background:#fcfdfd!important}
      @media(max-width:900px){
        .rw-side{width:285px!important}
        .rw-main{margin-left:0!important}
        .rw-main>header{height:70px!important;padding:0 15px!important}
        .rw-main main{padding:22px 14px 50px!important}
        .rw-head h2{font-size:25px!important}
        .rw-settings{grid-template-columns:1fr!important}
      }
    `}</style>
  </>;
}
