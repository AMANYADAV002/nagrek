// Live checks against the configured Supabase project. Creates throwaway users and deletes them.
// Run: npm run check:supabase
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !secret) throw new Error("Supabase env vars missing (URL, publishable key, secret key)");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const step = (name, ok, detail = "") => {
  if (!ok) process.exitCode = 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
/** Passes only for a real permission refusal, not for a missing table or column. */
const denied = (error) => Boolean(error) && (error.code === "42501" || /permission denied|violates row-level security/i.test(error.message));
const raised = (error, text) => Boolean(error) && error.message.includes(text);
const days = (iso) => Math.round((new Date(iso) - Date.now()) / 86_400_000);

const PREFIX = "nagrek.check.";
const PASSWORD = "Check-pass-12345";
const created = [];

async function makeUser(label, { onboard = true, plan = null, city = "Bengaluru", food = ["Biryani"], tone = "casual" } = {}) {
  const email = `${PREFIX}${label}.${Date.now()}@gmail.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  created.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);
  const id = data.user.id;
  if (onboard) {
    await client.from("user_preferences").upsert({
      user_id: id, food_interests: food, tone, city, area: "Indiranagar", lat: 12.97, lng: 77.64, dietary: "non-veg",
      budget_min: 200, budget_max: 800, group_size: "one-on-one", time_slots: ["Dinner"], languages: ["English"],
      topics: [], goals: [], date_of_birth: "1995-01-01",
    });
    await client.from("consents").insert({ user_id: id, adult: true, respectful: true, terms_version: "check" });
    await client.from("profiles").update({ city, area: "Indiranagar", tone, food_interests: food }).eq("id", id);
    await client.rpc("complete_onboarding");
  }
  if (plan) await grantPlan(id, plan);
  return { id, client };
}

async function mockOrder(userId, fields) {
  const orderId = `check_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await admin.from("payments").insert({ user_id: userId, status: "created", provider: "mock", provider_ref: orderId, ...fields });
  if (error) throw new Error(`payments insert: ${error.message}`);
  return orderId;
}

async function grantPlan(userId, plan) {
  const order = await mockOrder(userId, { amount_inr: 0, purpose: "plan", plan_id: plan });
  const { error } = await admin.rpc("fulfill_payment", { p_order_id: order, p_payment_id: `pay_${order}` });
  if (error) throw new Error(`fulfill_payment: ${error.message}`);
}

const sections = [];
const section = (name, run) => sections.push({ name, run });

// --- Phase 2: accounts --------------------------------------------------------
section("accounts", async () => {
  const { data: plans, error: plansErr } = await anon.from("plans").select("id, price_inr");
  step("plans seeded", !plansErr && plans.length === 3, plansErr?.message ?? plans.map((p) => `${p.id}=₹${p.price_inr}`).join(", "));

  const { error: codesErr, data: codes } = await anon.from("reward_codes").select("*");
  step("reward codes hidden from anonymous visitors", denied(codesErr) || codes?.length === 0, codesErr?.message ?? "0 rows");

  const me = await makeUser("a", { onboard: false });
  const { data: profile } = await me.client.from("profiles").select("id").eq("id", me.id).single();
  step("profile auto-created", profile?.id === me.id);

  const { error: upErr } = await me.client.from("profiles").update({ bio: "Chai first." }).eq("id", me.id);
  step("profile update", !upErr, upErr?.message);

  const { error: skipErr } = await me.client.rpc("complete_onboarding");
  step("onboarding blocked without consent", raised(skipErr, "Consent required"), skipErr?.message);

  await me.client.from("consents").insert({ user_id: me.id, adult: true, respectful: true, terms_version: "check" });
  const { error: doneErr } = await me.client.rpc("complete_onboarding");
  step("onboarding completes after consent", !doneErr, doneErr?.message);

  const { error: planHackErr } = await me.client.from("profiles").update({ plan_id: "ultra" }).eq("id", me.id);
  step("client cannot set its own plan", denied(planHackErr), planHackErr?.message);

  // The same nested reads the app does on sign-in (loadMyAccount).
  const friend = await makeUser("friend");
  const stranger = await makeUser("stranger");
  const { data: wish } = await me.client.from("wishlist_items").insert({ user_id: me.id, kind: "food", title: "Dosa crawl" }).select("id").single();
  const { error: shareErr } = await me.client.from("wishlist_shares").insert({ item_id: wish?.id, shared_with: friend.id });
  const { error: wishReadErr } = await me.client.from("wishlist_items").select("id, wishlist_shares(shared_with)").eq("user_id", me.id);
  const { error: planReadErr } = await me.client.from("plans_future").select("id, plan_invites(invitee_id)").eq("user_id", me.id);
  step("wish list and plans load with shares", !shareErr && !wishReadErr && !planReadErr, shareErr?.message ?? wishReadErr?.message ?? planReadErr?.message);
  const { data: friendSees } = await friend.client.from("wishlist_items").select("id").eq("id", wish?.id);
  const { data: strangerSees } = await stranger.client.from("wishlist_items").select("id").eq("id", wish?.id);
  step("shared wish visible only to the friend", friendSees?.length === 1 && strangerSees?.length === 0);
  const { error: hijackErr } = await stranger.client.from("wishlist_shares").insert({ item_id: wish?.id, shared_with: stranger.id });
  step("cannot share someone else's wish", denied(hijackErr), hijackErr?.message);
});

// --- Phase 3: payments --------------------------------------------------------
section("payments", async () => {
  const me = await makeUser("pay");

  const { error: selfGrantErr } = await me.client.rpc("fulfill_payment", { p_order_id: "x", p_payment_id: "y" });
  step("client cannot call fulfill_payment", denied(selfGrantErr), selfGrantErr?.message);

  const { error: payErr } = await me.client
    .from("payments")
    .insert({ user_id: me.id, amount_inr: 0, purpose: "plan", plan_id: "ultra", status: "paid", provider_ref: "fake" });
  step("client cannot write payments", denied(payErr), payErr?.message);

  const { error: invErr } = await me.client.from("user_avatar_inventory").insert({ user_id: me.id, category: "hair", item_id: "curly" });
  step("client cannot add avatar items", denied(invErr), invErr?.message);

  const avatar = { skin: "s2", hair: "curly", hairColor: "black", outfit: "tee", accessory: "none", background: "peach" };
  const { error: unpaidErr } = await me.client.rpc("save_avatar", { p_avatar: avatar });
  step("cannot save an unbought paid item", raised(unpaidErr, "has not been bought"), unpaidErr?.message);

  const order = await mockOrder(me.id, { amount_inr: 499, purpose: "plan", plan_id: "premium" });
  const { error: badAmountErr } = await admin.rpc("fulfill_payment", { p_order_id: order, p_payment_id: "p", p_amount_paise: 100 });
  step("amount mismatch is rejected", raised(badAmountErr, "Amount mismatch"), badAmountErr?.message);

  const { data: first, error: fulfilErr } = await admin.rpc("fulfill_payment", { p_order_id: order, p_payment_id: "p1", p_amount_paise: 49900 });
  const { data: second } = await admin.rpc("fulfill_payment", { p_order_id: order, p_payment_id: "p1" });
  const { data: paid } = await me.client.from("profiles").select("plan_id, plan_expires_at").eq("id", me.id).single();
  step("payment grants 30 days", !fulfilErr && first === "paid" && paid?.plan_id === "premium" && days(paid.plan_expires_at) === 30, fulfilErr?.message ?? `${paid?.plan_id}`);
  step("repeat confirmation is a no-op", second === "already_paid", String(second));

  await grantPlan(me.id, "premium");
  const { data: ext } = await me.client.from("profiles").select("plan_expires_at").eq("id", me.id).single();
  step("paying again extends the same plan", days(ext.plan_expires_at) === 60, `${days(ext.plan_expires_at)} days`);

  const { data: subs } = await me.client.from("subscriptions").select("status").eq("user_id", me.id);
  step("only one active subscription", subs?.filter((s) => s.status === "active").length === 1, `${subs?.length} rows`);

  const item = await mockOrder(me.id, { amount_inr: 49, purpose: "avatar_item", item_category: "hair", item_id: "curly" });
  await admin.rpc("fulfill_payment", { p_order_id: item, p_payment_id: "p3" });
  const { error: paidSaveErr } = await me.client.rpc("save_avatar", { p_avatar: avatar });
  step("bought item saves on the avatar", !paidSaveErr, paidSaveErr?.message);

  const { error: ultraErr } = await me.client.rpc("save_avatar", { p_avatar: { ...avatar, outfit: "neon" } });
  step("Ultra-only item refused on Premium", raised(ultraErr, "needs the ultra plan"), ultraErr?.message);
});

async function liveMatch(a, b, status = "live") {
  const { data, error } = await admin
    .from("matches")
    .insert({ user_a: a.id, user_b: b.id, food: "Biryani", status, a_decision: "accepted", b_decision: "accepted" })
    .select("id")
    .single();
  if (error) throw new Error(`matches insert: ${error.message}`);
  if (status === "live") await admin.from("meetings").insert({ match_id: data.id });
  return data.id;
}

/** Resolves with the channel status for a private Realtime topic. */
async function joinPrivate(client, topic) {
  const { data } = await client.auth.getSession();
  await client.realtime.setAuth(data.session?.access_token);
  return new Promise((resolve) => {
    const channel = client.channel(topic, { config: { private: true } });
    const timer = setTimeout(() => finish("TIMED_OUT"), 10_000);
    function finish(status) {
      clearTimeout(timer);
      void client.removeChannel(channel);
      resolve(status);
    }
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") finish(err ? `${status}: ${err.message}` : status);
    });
  });
}

function istMonth() {
  const ist = new Date(Date.now() + 5.5 * 3_600_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// --- Phase 4: matching --------------------------------------------------------
section("matching", async () => {
  const a = await makeUser("ma", { plan: "plus" });
  const b = await makeUser("mb", { plan: "plus" });
  const c = await makeUser("mc", { plan: "plus" });

  const { error: reqErr } = await a.client
    .from("match_requests")
    .insert({ user_id: a.id, food: "Biryani", tone: "casual", city: "Bengaluru", expires_at: new Date(Date.now() + 9e5).toISOString() });
  step("client cannot post requests directly", denied(reqErr), reqErr?.message);

  await admin.from("match_requests").insert({ user_id: b.id, food: "Biryani", tone: "casual", city: "Bengaluru", lat: 12.97, lng: 77.64, expires_at: new Date(Date.now() + 9e5).toISOString() });
  const { data: others } = await a.client.from("match_requests").select("id").eq("user_id", b.id);
  step("nobody can list other people's cravings", others?.length === 0, `${others?.length} rows`);

  const matchId = await liveMatch(a, b, "pending");
  const { data: seen } = await a.client.from("matches").select("id").eq("id", matchId);
  const { data: hidden } = await c.client.from("matches").select("id").eq("id", matchId);
  step("participants see their match, others don't", seen?.length === 1 && hidden?.length === 0);

  const { error: decideErr } = await a.client.from("matches").update({ b_decision: "accepted" }).eq("id", matchId);
  step("client cannot decide for the other person", denied(decideErr), decideErr?.message);

  await admin.from("notifications").insert({ user_id: b.id, kind: "match", payload: { matchId } });
  const { data: notes } = await a.client.from("notifications").select("id").eq("user_id", b.id);
  step("notifications are private", notes?.length === 0);
});

// --- Phase 5: meetings --------------------------------------------------------
section("meetings", async () => {
  const a = await makeUser("va", { plan: "plus" });
  const b = await makeUser("vb", { plan: "plus" });
  const c = await makeUser("vc", { plan: "plus" });
  const matchId = await liveMatch(a, b);

  const { error: streakErr } = await a.client.from("streak_events").insert({ user_id: a.id, type: "meeting_completed" });
  step("client cannot add streak days", denied(streakErr), streakErr?.message);

  const { data: meeting } = await admin.from("meetings").select("id").eq("match_id", matchId).single();
  const { error: fbErr } = await a.client.from("feedback").insert({ meeting_id: meeting.id, author_id: a.id, partner_id: b.id, rating: 1 });
  step("client cannot write ratings directly", denied(fbErr), fbErr?.message);

  const { error: repErr } = await a.client.from("reports").insert({ reporter_id: a.id, target_type: "user", target_id: b.id, reason: "Spam" });
  step("client cannot skip the report rate limit", denied(repErr), repErr?.message);

  const inRoom = await joinPrivate(a.client, `room:${matchId}`);
  step("participant can join the call channel", inRoom === "SUBSCRIBED", inRoom);
  const outsider = await joinPrivate(c.client, `room:${matchId}`);
  step("outsider cannot join the call channel", outsider !== "SUBSCRIBED", outsider);
});

// --- Phase 6: stories, rewards, leaderboard -----------------------------------
section("social", async () => {
  const a = await makeUser("sa", { plan: "plus" });
  const b = await makeUser("sb", { plan: "plus" });
  const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

  const { error: ownErr } = await a.client.storage.from("stories").upload(`${a.id}/check.jpg`, file, { contentType: "image/jpeg" });
  step("upload into your own story folder", !ownErr, ownErr?.message);
  const { error: otherErr } = await a.client.storage.from("stories").upload(`${b.id}/sneaky.jpg`, file, { contentType: "image/jpeg" });
  step("cannot upload into someone else's folder", Boolean(otherErr), otherErr?.message);
  const { error: readErr } = await b.client.storage.from("stories").download(`${a.id}/check.jpg`);
  step("story files are not directly downloadable", Boolean(readErr), readErr?.message);
  const { error: typeErr } = await a.client.storage.from("stories").upload(`${a.id}/x.html`, new Blob(["<p>"], { type: "text/html" }), { contentType: "text/html" });
  step("bucket rejects non-media files", Boolean(typeErr), typeErr?.message);

  const { error: storyErr } = await a.client.from("stories").insert({ user_id: a.id, kind: "image", storage_path: `${a.id}/check.jpg` });
  step("client cannot publish without the server", denied(storyErr), storyErr?.message);

  const { error: rpcErr } = await a.client.rpc("claim_reward", { p_user: a.id, p_reward: "r1" });
  step("client cannot call claim_reward", denied(rpcErr), rpcErr?.message);
  const { error: urErr } = await a.client.from("user_rewards").insert({ user_id: a.id, reward_id: "r1" });
  step("client cannot mark rewards claimed", denied(urErr), urErr?.message);
  const { data: codesSeen, error: codesErr } = await a.client.from("reward_codes").select("code");
  step("reward codes hidden from members", denied(codesErr) || codesSeen?.length === 0, codesErr?.message ?? "0 rows");

  const { error: shortErr } = await admin.rpc("claim_reward", { p_user: a.id, p_reward: "r1" });
  step("claim refused without the streak", raised(shortErr, "streak"), shortErr?.message);

  await admin.from("streaks").upsert({ user_id: a.id, current_count: 5, month: istMonth() });
  const { data: before } = await admin.from("rewards").select("stock").eq("id", "r1").single();
  const { data: code, error: claimErr } = await admin.rpc("claim_reward", { p_user: a.id, p_reward: "r1" });
  const { data: after } = await admin.from("rewards").select("stock").eq("id", "r1").single();
  step("claim issues a one-time code", !claimErr && typeof code === "string" && code.length > 4, claimErr?.message);
  step("stock goes down by one", after?.stock === (before?.stock ?? 0) - 1, `${before?.stock} -> ${after?.stock}`);
  const { error: againErr } = await admin.rpc("claim_reward", { p_user: a.id, p_reward: "r1" });
  step("second claim refused", raised(againErr, "already_claimed"), againErr?.message);

  const { error: premiumErr } = await admin.rpc("claim_reward", { p_user: a.id, p_reward: "r3" });
  step("plan-gated reward refused on Plus", raised(premiumErr, "plan") || raised(premiumErr, "streak"), premiumErr?.message);

  const { error: consentErr } = await a.client.from("story_consents").insert({ match_id: crypto.randomUUID(), requester_id: a.id, partner_id: b.id });
  step("client cannot fake story consent", denied(consentErr), consentErr?.message);

  const { error: boardErr } = await a.client.from("profiles").update({ show_on_leaderboard: true }).eq("id", a.id);
  step("leaderboard opt-in", !boardErr, boardErr?.message);
});

// --- Phase 7: admin -----------------------------------------------------------
section("admin", async () => {
  const a = await makeUser("ad", { plan: "plus" });
  const { error: roleErr } = await a.client.from("profiles").update({ role: "admin" }).eq("id", a.id);
  step("client cannot make itself admin", denied(roleErr), roleErr?.message);
  const { error: suspendErr } = await a.client.from("profiles").update({ suspended: false }).eq("id", a.id);
  step("client cannot change suspension", denied(suspendErr), suspendErr?.message);
  const { data: log, error: logErr } = await a.client.from("moderation_actions").select("id");
  step("audit log is server-only", denied(logErr) || log?.length === 0, logErr?.message ?? "0 rows");
  const { error: hideErr } = await a.client.from("stories").update({ hidden: false }).eq("user_id", a.id);
  step("client cannot unhide stories", denied(hideErr), hideErr?.message);
});

async function cleanup(ids) {
  if (!ids.length) return;
  // Give back demo reward codes used by the checks so repeated runs don't drain stock.
  const { data: used } = await admin.from("reward_codes").select("id, reward_id").in("claimed_by", ids);
  for (const c of used ?? []) {
    await admin.from("user_rewards").delete().eq("code_id", c.id);
    await admin.from("reward_codes").update({ claimed_by: null, claimed_at: null }).eq("id", c.id);
    const { data: r } = await admin.from("rewards").select("stock").eq("id", c.reward_id).single();
    await admin.from("rewards").update({ stock: (r?.stock ?? 0) + 1 }).eq("id", c.reward_id);
  }
  for (const id of ids) {
    const { data: files } = await admin.storage.from("stories").list(id);
    if (files?.length) await admin.storage.from("stories").remove(files.map((f) => `${id}/${f.name}`));
    await admin.auth.admin.deleteUser(id);
  }
}

const only = process.argv[2];
try {
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 500 });
  await cleanup((existing?.users ?? []).filter((u) => u.email?.startsWith(PREFIX)).map((u) => u.id));

  for (const s of sections) {
    if (only && s.name !== only) continue;
    console.log(`\n# ${s.name}`);
    try {
      await s.run();
    } catch (error) {
      step(`${s.name} crashed`, false, error.message);
    }
  }
} finally {
  await cleanup(created);
  console.log(`\ncleaned up ${created.length} test users`);
  process.exit();
}
