import {supabase,configured} from "./okc-supabase.js";
if(configured){
 const {data}=await supabase.from("site_content").select("content_value").eq("content_key","home_banner").maybeSingle();
 const v=data?.content_value;
 if(v){
  const title=document.querySelector('[data-cms-key="home_banner.title"]');
  const subtitle=document.querySelector('[data-cms-key="home_banner.subtitle"]');
  if(title&&v.title)title.textContent=v.title;
  if(subtitle&&v.subtitle)subtitle.textContent=v.subtitle;
  const hero=document.querySelector(".hero-img img");
  if(hero&&v.hero_image)hero.src=v.hero_image;
 }
 const {data:theme}=await supabase.from("site_content").select("content_value").eq("content_key","theme").maybeSingle();
 const color=theme?.content_value?.primary_color;
 if(color&&/^#[0-9a-f]{6}$/i.test(color)){
  document.documentElement.style.setProperty("--blue",color);
 }
}
