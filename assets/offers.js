import {supabase,configured} from "./okc-supabase.js";
const box=document.querySelector("#offersList");
const safe=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
if(!configured){box.textContent="Offers are temporarily unavailable.";}
else{
 const {data,error}=await supabase.from("club_offers").select("title,description,starts_on,ends_on").eq("is_published",true).order("created_at",{ascending:false});
 if(error)box.textContent="Could not load offers right now.";
 else{
  const today=new Date().toISOString().slice(0,10);
  const active=(data||[]).filter(o=>(!o.starts_on||o.starts_on<=today)&&(!o.ends_on||o.ends_on>=today));
  if(!active.length)box.textContent="There are no active offers at the moment.";
  else box.innerHTML=active.map(o=>`<article class="portal-stat"><h2>${safe(o.title)}</h2><p>${safe(o.description)}</p><small>${safe(o.starts_on||"Now")} – ${safe(o.ends_on||"Until announced")}</small></article>`).join("");
 }
}
