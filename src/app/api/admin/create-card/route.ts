import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, company, title, phone, username, plan = "pro", template = "classic-pro", accentColor } = await req.json();

  if (!name || !email || !username) {
    return NextResponse.json({ error: "name, email, and username are required" }, { status: 400 });
  }
  // Fail fast on a malformed email — the auth user would be created with it
  // and the recovery link would silently never arrive.
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Validate username
  if (!/^[a-z0-9-]+$/.test(username)) {
    return NextResponse.json({ error: "Username must be lowercase letters, numbers, and hyphens only" }, { status: 400 });
  }

  // Same enums set-plan / users/[id] enforce — a typo'd plan string must not
  // land in profiles.plan (plan gating reads it everywhere).
  if (!["free", "pro", "enterprise"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!["classic-pro", "modern-bold", "photo-first", "local-business", "luxury-minimal", "custom"].includes(template)) {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Check username is available
  const { data: existing } = await admin.from("profiles").select("id").eq("username", username).single();
  if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

  // Create the auth user — Supabase will send a magic link / password reset so the business owner can log in
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 500 });
  }

  const newUserId = authData.user.id;

  // Insert profile
  const { error: profileError } = await admin.from("profiles").insert({
    id: newUserId,
    username,
    name,
    email,
    company: company || null,
    title: title || null,
    phone: phone || null,
    plan,
    template,
    customization: accentColor ? { accentColor } : {},
  });

  if (profileError) {
    // Rollback auth user if profile insert fails
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Send password reset so they can set their own password and log in
  await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${APP_URL}/dashboard` },
  });

  return NextResponse.json({
    success: true,
    cardUrl: `${APP_URL}/card/${username}`,
    userId: newUserId,
  });
}
