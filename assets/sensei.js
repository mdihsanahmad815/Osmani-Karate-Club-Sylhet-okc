import {supabase,configured,showMessage} from "./okc-supabase.js";
const $=s=>document.querySelector(s);let user=null;
const note=(m,k="")=>showMessage($("#senseiNotice"),m,k);
async function init(){
 if(!configured){note("Supabase configuration missing.","error");return;}
 const {data:{user:u}}=await supabase.auth.getUser();user=u;
 if(!user){location.href="portal.html";return;}
 const {data:p,error}=await supabase.from("profiles").select("role,status").eq("id",user.id).maybeSingle();
 if(error||!p||p.role!=="sensei"||p.status!=="active"){note("Active Sensei permission required.","error");return;}
 await load();
}
async function load(){
 const {data,error}=await supabase.from("gallery_items").select("*").eq("created_by",user.id).order("created_at",{ascending:false});
 if(error){note(error.message,"error");return;}
 $("#senseiGallery").innerHTML=(data||[]).map(g=>{
  const src=g.media_type==="facebook"?g.external_url:supabase.storage.from("club-gallery").getPublicUrl(g.storage_path).data.publicUrl;
  const media=g.media_type==="video"?`<video controls src="${src}"></video>`:`<img src="${src}" alt="">`;
  return `<div>${media}<p class="portal-small">${String(g.caption||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</p><button class="portal-btn danger" data-del="${g.id}" data-path="${g.storage_path||""}">Delete</button></div>`;
 }).join("")||"<p>No uploads yet.</p>";
 document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this upload?"))return;if(b.dataset.path)await supabase.storage.from("club-gallery").remove([b.dataset.path]);const {error}=await supabase.from("gallery_items").delete().eq("id",b.dataset.del);if(error){note(error.message,"error");return;}await load();});
}
$("#senseiUpload").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget),file=f.get("file");
 if(!file||!file.size){note("Choose a photo or video first.","error");return;}
 if(file.size>50*1024*1024){note("File must be 50 MB or smaller.","error");return;}
 if(!/^image\\/(jpeg|png|webp)$|^video\\/(mp4|webm)$/.test(file.type)){note("Only JPG, PNG, WEBP, MP4 and WEBM are allowed.","error");return;}
 const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
 const {error:upErr}=await supabase.storage.from("club-gallery").upload(path,file);
 if(upErr){note(upErr.message,"error");return;}
 const {error}=await supabase.from("gallery_items").insert({caption:f.get("caption")||"",media_type:file.type.startsWith("video/")?"video":"image",storage_path:path,created_by:user.id,is_published:true});
 if(error){await supabase.storage.from("club-gallery").remove([path]);note(error.message,"error");return;}
 note("Upload published to gallery.","good");e.currentTarget.reset();await load();
});
$("#senseiLogout").onclick=async()=>{await supabase.auth.signOut();location.href="portal.html"};
await init();
