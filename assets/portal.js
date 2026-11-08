import {supabase,configured,money,showMessage,logActivity} from "./okc-supabase.js";
const $=s=>document.querySelector(s);
const authPanel=$("#authPanel"),studentPanel=$("#studentPanel");
let currentUser=null,currentStudent=null;
function note(id,msg,kind=""){showMessage($(id),msg,kind)}
function switchAuth(mode){$("#loginBox").classList.toggle("portal-hidden",mode!=="login");$("#signupBox").classList.toggle("portal-hidden",mode!=="signup");$("#loginTab").classList.toggle("active",mode==="login");$("#signupTab").classList.toggle("active",mode==="signup")}
$("#loginTab").onclick=()=>switchAuth("login");$("#signupTab").onclick=()=>switchAuth("signup");
if(!configured){note("#authMessage","Portal চালু করতে প্রথমে assets/supabase-config.js ফাইলে Supabase Project URL ও anon/public key বসাতে হবে।","error")}
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!configured)return;
 const f=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});
 if(error){note("#authMessage",error.message,"error");return;} const expected=f.get("login_role"); await loadPortal(expected);
});
$("#signupForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!configured)return;
 const f=new FormData(e.currentTarget);
 const {data,error}=await supabase.auth.signUp({email:f.get("email"),password:f.get("password"),options:{data:{full_name:f.get("full_name"),phone:f.get("phone"),roll_no:f.get("roll_no")}}});
 if(error){note("#authMessage",error.message,"error");return;}
 note("#authMessage",data.session?"অ্যাকাউন্ট তৈরি হয়েছে। Admin যাচাই করলে Student Profile চালু হবে।":"অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল কনফার্ম করে Login করো; এরপর Admin যাচাই করবেন।","good");
 switchAuth("login");e.currentTarget.reset();
});
$("#logoutBtn").onclick=async()=>{await supabase.auth.signOut();studentPanel.classList.add("portal-hidden");authPanel.classList.remove("portal-hidden");};
async function loadPortal(expectedRole=null){
 if(!configured)return;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return;
 currentUser=user;
 const {data:profile,error:pErr}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(pErr){note("#authMessage",pErr.message,"error");return;}
 if(!profile){note("#authMessage","Profile পাওয়া যায়নি। Supabase SQL schema সঠিকভাবে চালানো হয়েছে কি না দেখো।","error");return;}
 if(["admin","main_admin","developer"].includes(profile.role)){if(expectedRole && expectedRole!==profile.role && !(expectedRole==="admin" && profile.role==="main_admin")){await supabase.auth.signOut();note("#authMessage","নির্বাচিত Account Type এই ইমেইলের অনুমতির সঙ্গে মেলেনি। সঠিক Type নির্বাচন করো।","error");return;} location.href="admin-dashboard.html";return;} if(expectedRole!=="student"){await supabase.auth.signOut();note("#authMessage","এই Sensei/Trainer access-এর জন্য আলাদা permission dashboard এখনো configure করা হয়নি। Developer অনুমোদন ও setup প্রয়োজন।","error");return;}
 authPanel.classList.add("portal-hidden");studentPanel.classList.remove("portal-hidden");
 $("#welcomeName").textContent=`স্বাগতম, ${profile.full_name||user.email}`;
 $("#studentMeta").textContent=`অ্যাকাউন্ট: ${profile.status==="active"?"Active":"Pending Verification"}`;
 if(profile.status!=="active"){ $("#pendingBox").classList.remove("portal-hidden");return; }
 const {data:student,error}=await supabase.from("students").select("*").eq("user_id",user.id).maybeSingle();
 if(error){note("#studentMessage",error.message,"error");return;}
 if(!student){$("#pendingBox").classList.remove("portal-hidden");$("#pendingBox").textContent="তোমার Student Record এখনো যুক্ত করা হয়নি। Roll Number দিয়ে Admin-এর সঙ্গে যোগাযোগ করো।";return;}
 currentStudent=student;
 $("#studentData").classList.remove("portal-hidden");$("#paymentPanel").classList.remove("portal-hidden");$("#historyPanel").classList.remove("portal-hidden");
 $("#sRoll").textContent=student.roll_no;$("#sBelt").textContent=student.belt_level||"—";$("#sBatch").textContent=student.batch||"—";$("#sFee").textContent=money(student.monthly_fee);
 $("#paymentForm [name=amount]").value=student.monthly_fee||"";
 await loadPayments();
}
async function loadPayments(){
 const {data,error}=await supabase.from("payments").select("id,amount,payment_month,method,status,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false});
 if(error){note("#paymentMessage",error.message,"error");return;}
 $("#paymentRows").innerHTML=(data||[]).map(p=>`<tr><td>${new Date(p.payment_month+"T00:00:00").toLocaleDateString("en-GB",{month:"short",year:"numeric"})}</td><td>${money(p.amount)}</td><td>${p.method}</td><td><span class="portal-status ${p.status}">${p.status}</span></td><td>${new Date(p.created_at).toLocaleDateString()}</td></tr>`).join("")||'<tr><td colspan="5">এখনো কোনো Payment Record নেই।</td></tr>';
}
$("#paymentForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentStudent||!currentUser)return;
 const f=new FormData(e.currentTarget),month=f.get("payment_month"),file=f.get("proof");
 let proofPath=null;
 if(file&&file.size){
  if(file.size>10*1024*1024){note("#paymentMessage","ফাইল ১০ MB-এর বেশি হতে পারবে না।","error");return;}
  proofPath=`${currentUser.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const {error:upErr}=await supabase.storage.from("payment-proofs").upload(proofPath,file,{upsert:false});
  if(upErr){note("#paymentMessage","Proof upload হয়নি: "+upErr.message,"error");return;}
 }
 const {error}=await supabase.from("payments").insert({
  student_id:currentStudent.id,user_id:currentUser.id,amount:Number(f.get("amount")),
  payment_month:`${month}-01`,method:f.get("method"),sender_phone:f.get("sender_phone"),
  transaction_id:f.get("transaction_id").trim(),proof_path:proofPath,status:"pending"
 });
 if(error){note("#paymentMessage",error.message,"error");return;}
 await logActivity("payment_submitted","payment","",{month,amount:f.get("amount"),method:f.get("method")});
 note("#paymentMessage","Payment জমা হয়েছে। Admin যাচাই করার পর Status আপডেট হবে।","good");
 e.currentTarget.reset();$("#paymentForm [name=amount]").value=currentStudent.monthly_fee||"";
 await loadPayments();
});
if(configured){const {data:{session}}=await supabase.auth.getSession();if(session)await loadPortal();}
