/** True when the public Supabase URL and anon key are both set. Safe on the server and in the browser. */
export function backendEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
