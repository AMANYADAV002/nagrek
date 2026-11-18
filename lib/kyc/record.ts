import { encryptToken, keyFromSecret, referenceHash, type VerificationToken } from "@/lib/security/vault-crypto";
import type { Caller } from "@/lib/server/caller";
import { sendKycMail } from "@/lib/email/kyc-mail";

type Admin = Caller["admin"];

async function tokenKey(admin: Admin): Promise<Buffer | null> {
  const { data, error } = await admin.rpc("kyc_read_token_key");
  if (!error && typeof data === "string" && data.length > 0) return keyFromSecret(data);
  if (process.env.NODE_ENV !== "production" && process.env.KYC_TOKEN_KEY) return keyFromSecret(process.env.KYC_TOKEN_KEY);
  return null;
}

export async function markKycPending(admin: Admin, userId: string, provider: string, ip: string | null, referenceHashValue?: string): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("kyc_verifications")
    .upsert(
      {
        user_id: userId,
        status: "pending",
        provider,
        reference_hash: referenceHashValue ?? null,
        token_iv: null,
        token_tag: null,
        token_ciphertext: null,
        verified_at: null,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (error || !data) return null;
  await admin.from("kyc_status").upsert({ user_id: userId, status: "pending", updated_at: now }, { onConflict: "user_id" });
  const { error: auditError } = await admin.from("kyc_audit_logs").insert({
    actor_id: userId,
    action: "initiate",
    target_user_id: userId,
    ip,
  });
  if (auditError) return null;
  await sendKycMail(admin, userId, "pending");
  return data.id;
}

/** Seals a verified or rejected result. The identity payload is never an argument. */
export async function sealKycResult(
  admin: Admin,
  input: { userId: string; status: "verified" | "rejected"; provider: string; reference: string; ip: string | null },
): Promise<boolean> {
  const salt = process.env.KYC_HASH_SALT;
  const key = await tokenKey(admin);
  if (!salt || !key) return false;
  const at = new Date().toISOString();
  const token: VerificationToken = { provider: input.provider, status: input.status, at };
  const sealed = encryptToken(token, key, input.userId);
  const { error } = await admin.from("kyc_verifications").upsert(
    {
      user_id: input.userId,
      status: input.status,
      provider: input.provider,
      reference_hash: referenceHash(input.reference, salt),
      token_iv: sealed.iv.toString("base64"),
      token_tag: sealed.tag.toString("base64"),
      token_ciphertext: sealed.ciphertext.toString("base64"),
      verified_at: input.status === "verified" ? at : null,
      updated_at: at,
    },
    { onConflict: "user_id" },
  );
  if (error) return false;
  await admin.from("kyc_status").upsert({ user_id: input.userId, status: input.status, updated_at: at }, { onConflict: "user_id" });
  const { error: auditError } = await admin.from("kyc_audit_logs").insert({
    actor_id: null,
    action: input.status,
    target_user_id: input.userId,
    ip: input.ip,
  });
  if (auditError) return false;
  await sendKycMail(admin, input.userId, input.status);
  return true;
}
