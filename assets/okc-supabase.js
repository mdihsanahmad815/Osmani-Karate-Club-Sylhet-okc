import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const url = window.OKC_SUPABASE_URL;
const key = window.OKC_SUPABASE_ANON_KEY;
export const configured = !!url && !!key && !url.startsWith("YOUR_") && !key.startsWith("YOUR_");
export const supabase = configured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
export async function logActivity(action, entityType="", entityId="", details={}) {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("activity_logs").insert({
    actor_id:user.id, action, entity_type:entityType, entity_id:String(entityId||""), details
  });
}
export function money(value) {
  return new Intl.NumberFormat("en-BD",{style:"currency",currency:"BDT",maximumFractionDigits:0}).format(Number(value||0));
}
export function showMessage(target, message, kind="") {
  if (!target) return;
  target.textContent=message;
  target.className="portal-note"+(kind ? " "+kind : "");
  target.classList.remove("portal-hidden");
}
