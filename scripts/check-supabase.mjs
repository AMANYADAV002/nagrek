// Smoke test against the configured Supabase project.
// Run: node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase env vars missing");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const step = (name, ok, detail = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);

const { data: plans, error: plansErr } = await supabase.from("plans").select("id, price_inr");
step("plans seeded", !plansErr && plans.length > 0, plansErr?.message ?? plans.map((p) => `${p.id}=₹${p.price_inr}`).join(", "));

const { error: codesErr, data: codes } = await supabase.from("reward_codes").select("*");
step("reward codes hidden from client", Boolean(codesErr) || codes.length === 0, codesErr?.message ?? "0 rows visible");

// Email confirmation is on, so the throwaway user is created pre-confirmed with the server-only key.
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
for (const u of existing?.users ?? []) {
  if (u.email?.startsWith("nagrek.check.")) await admin.auth.admin.deleteUser(u.id);
}

const email = `nagrek.check.${Date.now()}@gmail.com`;
const password = "Check-pass-12345";
const { error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
step("create confirmed test user", !createErr, createErr?.message);
if (createErr) process.exit(1);

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
step("sign in", !signInErr && Boolean(signIn?.session), signInErr?.message);
if (signInErr) process.exit(1);

const uid = signIn.user.id;
const { data: profile, error: profErr } = await supabase.from("profiles").select("id, plan_id, onboarded_at").eq("id", uid).single();
step("profile auto-created", !profErr && profile?.id === uid, profErr?.message);

const { error: upErr } = await supabase.from("profiles").update({ city: "Mumbai", bio: "Chai first." }).eq("id", uid);
step("profile update", !upErr, upErr?.message);

const { error: skipErr } = await supabase.rpc("complete_onboarding");
step("onboarding blocked without consent", Boolean(skipErr), skipErr?.message);

const { error: consentErr } = await supabase
  .from("consents")
  .insert({ user_id: uid, adult: true, respectful: true, terms_version: "check" });
const { error: doneErr } = await supabase.rpc("complete_onboarding");
const { data: onboarded } = await supabase.from("profiles").select("onboarded_at").eq("id", uid).single();
step("onboarding completes after consent", !consentErr && !doneErr && Boolean(onboarded?.onboarded_at), consentErr?.message ?? doneErr?.message);

const { error: planHackErr, count } = await supabase.from("profiles").update({ plan_id: "plus" }, { count: "exact" }).eq("id", uid);
step("client cannot set plan_id directly", Boolean(planHackErr) || count === 0, planHackErr?.message);

const { error: rpcErr } = await supabase.rpc("activate_mock_plan", { p_plan: "plus" });
const { data: after } = await supabase.from("profiles").select("plan_id").eq("id", uid).single();
step("mock plan activation", !rpcErr && after?.plan_id === "plus", rpcErr?.message ?? `plan=${after?.plan_id}`);

const { error: delErr } = await supabase.rpc("delete_own_account");
step("test account deleted", !delErr, delErr?.message);
