import { NextResponse } from "next/server";
import { kycEnforced } from "@/lib/kyc/mode";
import { getMember } from "@/lib/server/caller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["pending", "verified", "rejected"]);

export async function GET() {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (!kycEnforced()) {
    return NextResponse.json({ required: false, status: "none", userId: member.userId }, { headers: { "Cache-Control": "no-store" } });
  }
  const { data, error } = await member.admin.from("kyc_verifications").select("status").eq("user_id", member.userId).maybeSingle();
  if (error) return NextResponse.json({ required: true, status: "none", userId: member.userId }, { headers: { "Cache-Control": "no-store" } });
  const status = typeof data?.status === "string" && STATUSES.has(data.status) ? data.status : "none";
  return NextResponse.json({ required: true, status, userId: member.userId }, { headers: { "Cache-Control": "no-store" } });
}
