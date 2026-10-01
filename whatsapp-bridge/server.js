import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';

const app=express();
app.use(cors());
app.use(express.json({limit:'64kb'}));
const port=Number(process.env.PORT||8080);
const token=process.env.WHATSAPP_BRIDGE_TOKEN||'';
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
let sock=null,qrData='',connected=false,phone='',displayName='';
const authDir=process.env.WHATSAPP_AUTH_DIR||'./data/auth';
const log=pino({level:process.env.LOG_LEVEL||'info'});
const authGuard=(req,res,next)=>{if(token&&req.headers.authorization!==`Bearer ${token}`)return res.status(401).json({error:'Unauthorized'});next()};

async function startWhatsApp(){
  const {state,saveCreds}=await useMultiFileAuthState(authDir);
  sock=makeWASocket({auth:state,browser:Browsers.ubuntu('Rider Shoes'),logger:log,markOnlineOnConnect:false,syncFullHistory:false});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async update=>{
    const {connection,lastDisconnect,qr}=update;
    if(qr)qrData=await QRCode.toDataURL(qr,{margin:2,width:320});
    if(connection==='open'){connected=true;qrData='';phone=sock.user?.id?.split(':')[0]||'';displayName=sock.user?.name||'';await supabase.from('whatsapp_connection').upsert({id:true,status:'connected',phone,display_name:displayName,last_connected_at:new Date().toISOString(),updated_at:new Date().toISOString()});}
    if(connection==='close'){connected=false;phone='';displayName='';await supabase.from('whatsapp_connection').upsert({id:true,status:'disconnected',updated_at:new Date().toISOString()});const code=lastDisconnect?.error?.output?.statusCode;if(code!==DisconnectReason.loggedOut)setTimeout(()=>startWhatsApp().catch(err=>log.error(err)),3000);}
  });
}
async function sendQueued(){
  if(!sock||!connected)return;
  const {data,error}=await supabase.from('whatsapp_message_queue').select('id,phone,message,attempts').eq('status','queued').order('created_at').limit(5);
  if(error||!data)return;
  for(const row of data){
    try{
      const jid=`${String(row.phone).replace(/\D/g,'')}@s.whatsapp.net`;
      await supabase.from('whatsapp_message_queue').update({status:'sending',attempts:Number(row.attempts||0)+1}).eq('id',row.id).eq('status','queued');
      await sock.sendMessage(jid,{text:row.message});
      await supabase.from('whatsapp_message_queue').update({status:'sent',sent_at:new Date().toISOString(),last_error:null}).eq('id',row.id);
    }catch(err){await supabase.from('whatsapp_message_queue').update({status:'queued',last_error:String(err)}).eq('id',row.id);}
  }
}
app.get('/status',authGuard,(req,res)=>res.json({connected,phone,displayName}));
app.get('/qr',authGuard,(req,res)=>{if(connected)return res.status(409).send('Already connected');if(!qrData)return res.status(404).send('QR not ready');res.type('html').send(`<!doctype html><html><body style="margin:0;background:white;display:grid;place-items:center"><img alt="WhatsApp QR" src="${qrData}" width="320" height="320"></body></html>`)});
app.post('/send-message',authGuard,async(req,res)=>{if(!connected)return res.status(409).json({error:'WhatsApp is not connected'});const phone=String(req.body?.phone||'').replace(/\D/g,'');const message=String(req.body?.message||'');if(phone.length<8||!message)return res.status(400).json({error:'phone and message are required'});try{await sock.sendMessage(`${phone}@s.whatsapp.net`,{text:message});res.json({success:true})}catch(e){res.status(500).json({error:String(e)})}});
app.listen(port,()=>log.info({port},'Rider Shoes WhatsApp bridge started'));
startWhatsApp().catch(err=>log.error(err));
setInterval(()=>void sendQueued(),3000);
