import { useEffect } from "react";
import { AdminWorkspace as BaseAdminWorkspace } from "./pages/AdminWorkspaceFixed";

const SIZE_PRESETS=["6","7","8","9","10","11","12"];

function enhanceSizeEditor(){
  const inputs=Array.from(document.querySelectorAll<HTMLInputElement>('input[name="pz"]'));
  inputs.forEach(input=>{
    input.setAttribute("inputmode","text");
    input.setAttribute("autocomplete","off");
    input.setAttribute("spellcheck","false");
    input.setAttribute("aria-label","Product sizes separated by commas");
    if(input.dataset.sizeHelperReady)return;
    input.dataset.sizeHelperReady="1";
    const host=input.parentElement;
    if(!host)return;
    const helper=document.createElement("div");
    helper.className="size-helper-row";
    helper.innerHTML=`<span>Quick add:</span>${SIZE_PRESETS.map(s=>`<button type="button" data-size="${s}">${s}</button>`).join("")}<small>or type sizes like 7, 8, 9</small>`;
    helper.querySelectorAll<HTMLButtonElement>("button").forEach(btn=>btn.addEventListener("click",()=>{
      const value=input.value.split(",").map(x=>x.trim()).filter(Boolean);
      const size=btn.dataset.size||"";
      if(!value.includes(size))value.push(size);
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
      setter?.call(input,value.join(", "));
      input.dispatchEvent(new Event("input",{bubbles:true}));
      input.dispatchEvent(new Event("change",{bubbles:true}));
      input.focus();
    }));
    host.appendChild(helper);
  });
}

export function AdminWorkspace(){
  useEffect(()=>{
    enhanceSizeEditor();
    const observer=new MutationObserver(enhanceSizeEditor);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>observer.disconnect();
  },[]);
  return <BaseAdminWorkspace/>;
}
