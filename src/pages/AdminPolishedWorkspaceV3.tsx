import { useEffect } from "react";
import { AdminPolishedWorkspaceV2 } from "./AdminPolishedWorkspaceV2";

export function AdminPolishedWorkspaceV3(){
  useEffect(()=>{
    const onPointerDown=(event:PointerEvent)=>{
      const side=document.querySelector<HTMLElement>(".rw-side.open");
      if(!side)return;
      const target=event.target as Node|null;
      if(target&&side.contains(target))return;
      const close=side.querySelector<HTMLButtonElement>(".rw-logo > button");
      close?.click();
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      document.querySelector<HTMLButtonElement>(".rw-side.open .rw-logo > button")?.click();
    };
    document.addEventListener("pointerdown",onPointerDown);
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKey)};
  },[]);
  return <AdminPolishedWorkspaceV2/>;
}
