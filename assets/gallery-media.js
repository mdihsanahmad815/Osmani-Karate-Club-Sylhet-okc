import {supabase,configured} from "./okc-supabase.js";
if(configured){
 const grid=document.querySelector(".gallery-grid");
 if(grid){
  const {data}=await supabase.from("gallery_items").select("*").eq("is_published",true).order("sort_order").order("created_at",{ascending:false});
  (data||[]).forEach(item=>{
   const wrap=document.createElement("div");wrap.className="gallery-item";
   if(item.media_type==="facebook"){
    const a=document.createElement("a");a.href=item.external_url;a.target="_blank";a.rel="noopener";a.textContent=item.caption||"Facebook Post";a.className="gallery-caption";wrap.appendChild(a);
   }else{
    const src=supabase.storage.from("club-gallery").getPublicUrl(item.storage_path).data.publicUrl;
    const media=document.createElement(item.media_type==="video"?"video":"img");
    media.src=src;media.alt=item.caption||"Osmani Karate Club Sylhet gallery";
    if(item.media_type==="video"){media.controls=true;media.playsInline=true;}
    else {
     media.loading="lazy";media.dataset.lightbox=src;
     media.addEventListener("click",()=>{
      const box=document.createElement("div");
      box.style.cssText="position:fixed;inset:0;background:rgba(0,10,25,.88);z-index:100;display:grid;place-items:center;padding:20px;cursor:zoom-out";
      const enlarged=document.createElement("img");enlarged.src=src;enlarged.alt=media.alt;
      enlarged.style.cssText="max-width:96vw;max-height:90vh;border-radius:22px;box-shadow:0 30px 100px #000";
      box.appendChild(enlarged);box.onclick=()=>box.remove();document.body.appendChild(box);
     });
    }
    wrap.appendChild(media);
    if(item.caption){const cap=document.createElement("div");cap.className="gallery-caption";cap.textContent=item.caption;wrap.appendChild(cap);}
   }
   grid.appendChild(wrap);
  });
 }
}
