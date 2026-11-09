import {supabase,configured,money,showMessage,logActivity} from "./okc-supabase.js";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null,profile=null,students=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const note=(id,msg,kind="")=>showMessage($(id),msg,kind);
function switchTab(tab){$$("[data-panel]").forEach(p=>p.classList.toggle("portal-hidden",p.dataset.panel!==tab));$$("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));}
$$("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
$("#adminLogout").onclick=async()=>{if(supabase)await supabase.auth.signOut();location.href="portal.html"};
async function init(){
 if(!configured){note("#adminNotice","Supabase configuration প্রয়োজন। SETUP-GUIDE-BN.md অনুসরণ করো।","error");$("#accessDenied").classList.remove("portal-hidden");return;}
 const {data:{user:u}}=await supabase.auth.getUser();user=u;
 if(!user){location.href="portal.html";return;}
 const {data:p,error}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=p;
 if(error||!p||!( ["admin","main_admin","developer"].includes(p.role))||p.status!=="active"){
  $("#accessDenied").classList.remove("portal-hidden");return;
 }
 $("#dashboard").classList.remove("portal-hidden");
 $("#adminTitle").textContent=`স্বাগতম, ${p.full_name||"Admin"}`;
 $("#adminRoleText").textContent=p.role==="main_admin"?"Main Admin • Full Control":p.role.toUpperCase()+" • Assigned Access";
 if(["main_admin","developer"].includes(p.role))$("#accountsTab").classList.remove("portal-hidden");
 await Promise.all([loadStudents(),loadPayments(),loadGallery(),loadContent(),loadActivity(),loadAccounts(),loadExams(),loadOffers()]);
}
async function loadStudents(){
 const {data,error}=await supabase.from("students").select("*").order("roll_no");
 if(error){note("#studentNotice",error.message,"error");return;}
 students=data||[];$("#countStudents").textContent=students.length;
 const {data:allProfiles}=await supabase.from("profiles").select("id,email");
 const emailByUser=new Map((allProfiles||[]).map(p=>[p.id,p.email]));
 const examSelect=$("#examStudent"); if(examSelect) examSelect.innerHTML=students.map(s=>`<option value="${s.id}">${esc(s.roll_no)} — ${esc(s.full_name)}</option>`).join("");

 $("#studentsRows").innerHTML=students.map(s=>`<tr><td>${esc(s.roll_no)}</td><td>${esc(s.full_name)}</td><td>${esc(emailByUser.get(s.user_id)||"—")}</td><td>${esc(s.phone||"—")}</td><td>${esc(s.guardian_name||"—")}<br>${esc(s.guardian_phone||"")}</td><td>${esc(s.address||"—")}</td><td>${esc(s.batch||"—")}</td><td>${esc(s.belt_level||"—")}</td><td>${money(s.monthly_fee)}</td><td><span class="portal-status ${s.status}">${esc(s.status)}</span></td></tr>`).join("")||'<tr><td colspan="6">কোনো Student Record নেই।</td></tr>';
}
$("#studentForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget),roll=f.get("roll_no").trim();
 const record={roll_no:roll,full_name:f.get("full_name").trim(),phone:f.get("phone"),guardian_name:f.get("guardian_name"),guardian_phone:f.get("guardian_phone"),batch:f.get("batch"),belt_level:f.get("belt_level"),monthly_fee:Number(f.get("monthly_fee")||0),status:f.get("status")};
 const {data,error}=await supabase.from("students").insert(record).select().single();
 if(error){note("#studentNotice",error.message,"error");return;}
 // If a signup requested this exact roll, Main Admin can link it and activate it.
 if(profile.role==="main_admin"){
  const {data:pending}=await supabase.from("profiles").select("id").eq("requested_roll_no",roll).eq("status","pending").limit(1);
  if(pending?.length){
   await supabase.from("students").update({user_id:pending[0].id}).eq("id",data.id);
   await supabase.from("profiles").update({status:"active"}).eq("id",pending[0].id);
  }
 }
 await logActivity("student_created","student",data.id,{roll_no:roll});
 note("#studentNotice","Student Record যোগ হয়েছে। একই Roll Number দিয়ে কেউ Account খুলে থাকলে Main Admin-এর মাধ্যমে Link/Activate করতে হবে।","good");
 e.currentTarget.reset();await loadStudents();await loadActivity();
});
async function loadPayments(){
 const {data,error}=await supabase.from("payments").select("*,students(full_name,roll_no)").order("created_at",{ascending:false}).limit(150);
 if(error){note("#adminNotice","Payment load: "+error.message,"error");return;}
 const list=data||[];$("#countPending").textContent=list.filter(p=>p.status==="pending").length;
 const rows=await Promise.all(list.map(async p=>{
  let proof="—";if(p.proof_path){const {data:signed}=await supabase.storage.from("payment-proofs").createSignedUrl(p.proof_path,300);if(signed?.signedUrl)proof=`<a href="${esc(signed.signedUrl)}" target="_blank" rel="noopener">View</a>`;}
  const actions=p.status==="pending"?`<div class="portal-actions"><button class="portal-btn success" data-payment="${p.id}" data-status="approved">Approve</button><button class="portal-btn danger" data-payment="${p.id}" data-status="rejected">Reject</button></div>`:`<span class="portal-status ${p.status}">${p.status}</span>`;
  return `<tr><td>${esc(p.students?.full_name||"—")} (${esc(p.students?.roll_no||"")})</td><td>${esc(p.payment_month)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.transaction_id||"—")}</td><td>${proof}</td><td>${actions}</td></tr>`;
 }));
 $("#paymentsRows").innerHTML=rows.join("")||'<tr><td colspan="7">কোনো Payment নেই।</td></tr>';
 $$("[data-payment]").forEach(b=>b.onclick=()=>reviewPayment(b.dataset.payment,b.dataset.status));
}
async function reviewPayment(id,status){
 const adminNote=prompt(status==="approved"?"Approval note (optional):":"Reject করার কারণ লিখুন:");
 if(status==="rejected"&&!adminNote)return;
 const {error}=await supabase.from("payments").update({status,admin_note:adminNote||null,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",id);
 if(error){note("#adminNotice",error.message,"error");return;}
 await logActivity(`payment_${status}`,"payment",id,{note:adminNote||""});await loadPayments();await loadActivity();
}
$("#galleryForm [name=media_type]").onchange=e=>{
 const isLink=e.target.value==="facebook";$("#galleryFileField").classList.toggle("portal-hidden",isLink);$("#galleryUrlField").classList.toggle("portal-hidden",!isLink);
};
$("#galleryForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget),type=f.get("media_type"),caption=f.get("caption")||"";
 let record={caption,media_type:type,created_by:user.id,is_published:true};
 if(type==="facebook"){record.external_url=f.get("external_url");if(!record.external_url){note("#galleryNotice","Facebook URL দাও।","error");return;}}
 else{
  const file=f.get("file");if(!file||!file.size){note("#galleryNotice","একটি ছবি বা ভিডিও নির্বাচন করো।","error");return;}
  if(file.size>50*1024*1024){note("#galleryNotice","ফাইল সর্বোচ্চ ৫০ MB হতে পারবে।","error");return;}
  const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const {error:upErr}=await supabase.storage.from("club-gallery").upload(path,file);
  if(upErr){note("#galleryNotice",upErr.message,"error");return;}
  record.storage_path=path;record.media_type=file.type.startsWith("video/")?"video":"image";
 }
 const {data,error}=await supabase.from("gallery_items").insert(record).select().single();
 if(error){note("#galleryNotice",error.message,"error");return;}
 await logActivity("gallery_item_added","gallery",data.id,{caption});
 note("#galleryNotice","Gallery-তে যোগ হয়েছে।","good");e.currentTarget.reset();await loadGallery();await loadActivity();
});
async function loadGallery(){
 const {data,error}=await supabase.from("gallery_items").select("*").order("created_at",{ascending:false}).limit(100);
 if(error)return;
 $("#countGallery").textContent=(data||[]).length;
 $("#adminGallery").innerHTML=(data||[]).map(g=>{
  const url=g.media_type==="facebook"?g.external_url:(supabase.storage.from("club-gallery").getPublicUrl(g.storage_path).data.publicUrl);
  const media=g.media_type==="video"?`<video src="${esc(url)}" controls></video>`:g.media_type==="image"?`<img src="${esc(url)}" alt="">`:`<a href="${esc(url)}" target="_blank">Facebook Post</a>`;
  return `<div>${media}<div class="portal-small">${esc(g.caption)}</div><button class="portal-btn danger" data-gallery-delete="${g.id}" style="margin-top:6px">Delete</button></div>`;
 }).join("")||"<p>Gallery খালি।</p>";
 $$("[data-gallery-delete]").forEach(b=>b.onclick=()=>deleteGallery(b.dataset.galleryDelete));
}
async function deleteGallery(id){
 if(!confirm("এই Gallery item মুছে ফেলবে?"))return;
 const item=(await supabase.from("gallery_items").select("*").eq("id",id).single()).data;
 if(item?.storage_path)await supabase.storage.from("club-gallery").remove([item.storage_path]);
 const {error}=await supabase.from("gallery_items").delete().eq("id",id);
 if(error){note("#galleryNotice",error.message,"error");return;}
 await logActivity("gallery_item_deleted","gallery",id);await loadGallery();await loadActivity();
}
async function loadContent(){
 const {data}=await supabase.from("site_content").select("content_value").eq("content_key","home_banner").maybeSingle();
 const {data:themeData}=await supabase.from("site_content").select("content_value").eq("content_key","theme").maybeSingle();
 const v=data?.content_value||{title:"শিখবো কারাতে — শিখাবো কারাতে — কারাতে শিখবে বাংলাদেশ 🇧🇩",subtitle:"Osmani Karate Club Sylhet"};
 $("#contentForm [name=title]").value=v.title||"";$("#contentForm [name=subtitle]").value=v.subtitle||"";
 $("#contentForm [name=primary_color]").value=themeData?.content_value?.primary_color||"#087cff";
}
$("#contentForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 const {error}=await supabase.from("site_content").upsert({content_key:"home_banner",content_value:{title:f.get("title"),subtitle:f.get("subtitle")},updated_by:user.id,updated_at:new Date().toISOString()});
 if(error){note("#contentNotice",error.message,"error");return;}
 await logActivity("site_content_updated","site_content","home_banner");note("#contentNotice","Content Save হয়েছে। Public Home Page-এ দেখাতে CMS script-ও যুক্ত আছে।","good");
});
async function loadAccounts(){
 if(profile.role!=="main_admin")return;
 const {data,error}=await supabase.from("profiles").select("id,full_name,email,phone,role,status,created_at").order("created_at",{ascending:false});
 if(error){note("#accountNotice",error.message,"error");return;}
 $("#countProfiles").textContent=(data||[]).filter(p=>p.status==="pending").length;
 const admins=(data||[]).filter(p=>p.role==="admin").length;
 $("#accountsRows").innerHTML=(data||[]).map(p=>{
  const canEdit=p.id!==user.id&&p.role!=="main_admin";
  const roleOptions=`<option value="student" ${p.role==="student"?"selected":""}>Student</option><option value="sensei" ${p.role==="sensei"?"selected":""}>Sensei</option><option value="trainer" ${p.role==="trainer"?"selected":""}>Trainer</option><option value="admin" ${p.role==="admin"?"selected":""}>Admin</option>`;
  return `<tr><td>${esc(p.full_name||"—")}<br><small>${esc(p.phone||"")}</small></td><td>${esc(p.email||p.id)}</td><td>${canEdit?`<select data-role-select="${p.id}">${roleOptions}</select>`:esc(p.role)}</td><td>${esc(p.status)}</td><td>${canEdit?`<button class="portal-btn secondary" data-account-save="${p.id}" data-old-role="${p.role}">Save</button>`:"—"}</td></tr>`;
 }).join("");
 $$("[data-account-save]").forEach(b=>b.onclick=()=>updateAccount(b.dataset.accountSave,b.dataset.oldRole,admins));
}
async function updateAccount(id,oldRole,adminCount){
 const select=$(`[data-role-select="${id}"]`),newRole=select.value;
 if(newRole==="admin"&&oldRole!=="admin"&&adminCount>=2){note("#accountNotice","সর্বোচ্চ ২ জন সাধারণ Admin রাখা যাবে। Main Admin আলাদা।","error");return;}
 if(!confirm(`এই Account-এর Role ${newRole} করতে চাও?`))return;
 const update={role:newRole,status:newRole==="student"?"pending":"active",updated_at:new Date().toISOString()};
 const {error}=await supabase.from("profiles").update(update).eq("id",id);
 if(error){note("#accountNotice",error.message,"error");return;}
 await logActivity("account_role_updated","profile",id,{role:newRole});note("#accountNotice","Role update হয়েছে।","good");await loadAccounts();await loadActivity();
}
async function loadActivity(){
 const {data}=await supabase.from("activity_logs").select("id,actor_id,action,details,created_at").order("created_at",{ascending:false}).limit(40);
 $("#activityRows").innerHTML=(data||[]).map(a=>`<tr><td>${new Date(a.created_at).toLocaleString()}</td><td><small>${esc(a.actor_id||"—")}</small></td><td>${esc(a.action)}</td><td>${esc(JSON.stringify(a.details||{}))}</td></tr>`).join("")||'<tr><td colspan="4">কোনো Activity নেই।</td></tr>';
}

async function loadExams(){
 const {data,error}=await supabase.from("exam_results").select("*,students(full_name,roll_no)").order("created_at",{ascending:false}).limit(250);
 if(error){note("#examNotice","Exam results: "+error.message,"error");return;}
 $("#examRows").innerHTML=(data||[]).map(r=>`<tr><td>${esc(r.students?.roll_no||"")} — ${esc(r.students?.full_name||"")}</td><td>${esc(r.exam_name)}</td><td>${esc(r.exam_date||"—")}</td><td>${esc(r.score??"—")}</td><td>${esc(r.grade||"—")}</td><td>${esc(r.result)}</td><td><button class="portal-btn danger" data-exam-delete="${r.id}">Delete</button></td></tr>`).join("")||'<tr><td colspan="7">No exam results yet.</td></tr>';
 $$("[data-exam-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this result?"))return;const {error}=await supabase.from("exam_results").delete().eq("id",b.dataset.examDelete);if(error){note("#examNotice",error.message,"error");return;}await loadExams();});
}
$("#examForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 const row={student_id:f.get("student_id"),exam_name:f.get("exam_name").trim(),exam_date:f.get("exam_date")||null,subject:f.get("subject")||"Karate Examination",score:f.get("score")?Number(f.get("score")):null,grade:f.get("grade")||null,result:f.get("result").trim(),remarks:f.get("remarks")||"",published:true,created_by:user.id};
 const {error}=await supabase.from("exam_results").insert(row);if(error){note("#examNotice",error.message,"error");return;}
 note("#examNotice","Exam result published.","good");e.currentTarget.reset();await loadExams();await logActivity("exam_result_published","exam_result","",{exam:row.exam_name});
});
async function loadOffers(){
 const {data,error}=await supabase.from("club_offers").select("*").order("created_at",{ascending:false}).limit(100);
 if(error){note("#offerNotice","Offers: "+error.message,"error");return;}
 $("#offerRows").innerHTML=(data||[]).map(o=>`<tr><td><b>${esc(o.title)}</b><br>${esc(o.description)}</td><td>${esc(o.starts_on||"Any")} – ${esc(o.ends_on||"Any")}</td><td>${o.is_published?"Published":"Hidden"}</td><td><button class="portal-btn secondary" data-offer-toggle="${o.id}" data-published="${o.is_published}">${o.is_published?"Hide":"Publish"}</button> <button class="portal-btn danger" data-offer-delete="${o.id}">Delete</button></td></tr>`).join("")||'<tr><td colspan="4">No offers available.</td></tr>';
 $$("[data-offer-toggle]").forEach(b=>b.onclick=async()=>{const {error}=await supabase.from("club_offers").update({is_published:b.dataset.published!=="true"}).eq("id",b.dataset.offerToggle);if(error){note("#offerNotice",error.message,"error");return;}await loadOffers();});
 $$("[data-offer-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this offer?"))return;const {error}=await supabase.from("club_offers").delete().eq("id",b.dataset.offerDelete);if(error){note("#offerNotice",error.message,"error");return;}await loadOffers();});
}
$("#offerForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget),row={title:f.get("title").trim(),description:f.get("description")||"",starts_on:f.get("starts_on")||null,ends_on:f.get("ends_on")||null,is_published:true,created_by:user.id};
 const {error}=await supabase.from("club_offers").insert(row);if(error){note("#offerNotice",error.message,"error");return;}
 note("#offerNotice","Offer published.","good");e.currentTarget.reset();await loadOffers();await logActivity("offer_published","offer","",{title:row.title});
});

await init();
