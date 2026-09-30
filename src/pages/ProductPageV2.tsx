import { useEffect } from "react";
import { ProductPage } from "./ProductPage";

/**
 * Anonymous catalog readers intentionally do not receive inventory quantities.
 * ProductPage can therefore render the CTA as disabled even though a variant
 * exists and can be added to the cart. Keep the actual availability decision
 * in the checkout/database layer and never disable the customer CTA here.
 */
export function ProductPageV2(){
  useEffect(()=>{
    const enableCtas=()=>document.querySelectorAll<HTMLButtonElement>(".detail-actions button").forEach(button=>button.removeAttribute("disabled"));
    enableCtas();
    const observer=new MutationObserver(enableCtas);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["disabled"]});
    return()=>observer.disconnect();
  },[]);
  return <ProductPage/>;
}
