export const dynamic = "force-dynamic";

// Signup and login use the same Supabase magic link flow
// Supabase creates the account if it doesn't exist
export { default } from "../login/page";
