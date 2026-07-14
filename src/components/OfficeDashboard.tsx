"use client";

import { useState } from "react";
import { isInviteExpired, inviteDaysLeft } from "@/lib/office-invite";

type Member = {
  id: string;
  invite_email: string;
  invite_token: string;
  status: string;
  role: string;
  joined_at: string | null;
  user_id: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

type Office = {
  id: string;
  name: string;
  seats: number;
};

type Caps = { canInvite: boolean; canRemove: boolean; canBrand: boolean; canManageRoles: boolean; canManageSeats: boolean };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", manager: "Manager", billing_admin: "Billing Admin", employee: "Employee",
};

export default function OfficeDashboard({
  office,
  members,
  appUrl,
  viewerRole = "owner",
  caps = { canInvite: true, canRemove: true, canBrand: true, canManageRoles: true, canManageSeats: true },
}: {
  office: Office;
  members: Member[];
  appUrl: string;
  viewerRole?: string;
  caps?: Caps;
}) {
  void viewerRole;
  const [email, setEmail] = useState("");
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteError, setInviteError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [memberList, setMemberList] = useState<Member[]>(members);

  // Only active + pending invitations are shown; revoked/declined are historical.
  const visibleMembers = memberList.filter((m) => m.status === "active" || m.status === "pending");
  const activeCount = memberList.filter((m) => m.status === "active").length;
  // Non-expired pending invites (an expired invite no longer reserves a seat).
  const pendingCount = memberList.filter((m) => m.status === "pending" && !isInviteExpired(m)).length;
  // Seats include YOU (the owner = seat 1) + active members + pending invites,
  // which each reserve a seat — matches the server's seat accounting (spec §2/§4).
  const usedSeats = 1 + activeCount + pendingCount;
  const seatsLeft = Math.max(0, office.seats - usedSeats);
  const seatsFull = seatsLeft <= 0;

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviteStatus("sending");
    setInviteError("");

    const res = await fetch("/api/office/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const json = await res.json();

    if (!res.ok) {
      setInviteError(json.message ?? json.error ?? "Failed to send invite.");
      setInviteStatus("error");
      return;
    }

    setInviteStatus("sent");
    setEmail("");
    setTimeout(() => setInviteStatus("idle"), 3000);
    window.location.reload();
  }

  async function removeMember(memberId: string) {
    setRemovingId(memberId);
    const res = await fetch(`/api/office/members?id=${memberId}`, { method: "DELETE" });
    if (res.ok) {
      // Active member removed → row gone; pending invite revoked → hide it too.
      setMemberList((prev) => prev.filter((m) => m.id !== memberId));
    }
    setRemovingId(null);
  }

  async function resendInvite(inviteEmail: string) {
    setResendingEmail(inviteEmail);
    const res = await fetch("/api/office/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    setResendingEmail(null);
    if (res.ok) window.location.reload();
  }

  function copyInviteLink(member: Member) {
    const link = `${appUrl}/join/${member.invite_token}`;
    try { navigator.clipboard?.writeText(link); } catch { /* ignore */ }
    setCopiedId(member.id);
    setTimeout(() => setCopiedId((c) => (c === member.id ? null : c)), 1800);
  }

  async function changeRole(memberId: string, role: string) {
    setRoleSavingId(memberId);
    const res = await fetch("/api/office/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    if (res.ok) {
      setMemberList((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    }
    setRoleSavingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Office header card */}
      <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Office</p>
            <h2 className="text-xl font-bold text-slate-900">{office.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{usedSeats} <span className="text-slate-400 text-base font-normal">/ {office.seats}</span></p>
            <p className="text-slate-400 text-xs mt-0.5">seats used</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          {[
            { label: "You", value: 1, color: "#c4b5fd" },
            { label: "Active", value: activeCount, color: "#86efac" },
            { label: "Pending", value: pendingCount, color: "#fcd34d" },
            { label: "Available", value: seatsLeft, color: "#93c5fd" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form — only for roles that may invite (server also enforces) */}
      {caps.canInvite && (
      <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-4">Invite a team member</p>
        <form onSubmit={sendInvite} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            className="flex-1 bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition-colors"
          />
          <button
            type="submit"
            disabled={inviteStatus === "sending" || seatsFull}
            className="shrink-0 bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {inviteStatus === "sending" ? "Sending…" : inviteStatus === "sent" ? "Sent!" : "Send invite"}
          </button>
        </form>
        {inviteStatus === "error" && <p className="text-red-500 text-xs mt-2">{inviteError}</p>}
        {seatsFull && (
          <p className="text-amber-600 text-xs mt-2">
            You&apos;ve used all {office.seats} seats (you + {activeCount} active + {pendingCount} pending).{" "}
            <a href="/settings/flows?billing=1#billing" className="underline font-semibold hover:text-amber-500">
              Add a seat to invite more →
            </a>
          </p>
        )}
      </div>
      )}

      {/* Member list */}
      <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-4">
          Members ({visibleMembers.length})
        </p>

        {visibleMembers.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No members yet. Send your first invite above.</p>
        ) : (
          <div className="space-y-2">
            {visibleMembers.map((member) => {
              const expired = member.status === "pending" && isInviteExpired(member);
              const daysLeft = member.status === "pending" ? inviteDaysLeft(member) : 0;
              return (
              <div key={member.id} className="flex items-center justify-between bg-[#F0EBE1] rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-slate-900 text-sm font-medium truncate">{member.invite_email}</p>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: member.status === "active" ? "#dcfce7" : expired ? "#fee2e2" : "#fef9c3",
                        color: member.status === "active" ? "#15803d" : expired ? "#b91c1c" : "#854d0e",
                      }}
                    >
                      {member.status === "active" ? "Active" : expired ? "Expired" : "Pending"}
                    </span>
                    {member.status === "pending" && !expired && (
                      <span className="shrink-0 text-[10px] text-slate-400">Expires in {daysLeft}d</span>
                    )}
                  </div>
                  {member.status === "active" && member.joined_at && (
                    <p className="text-slate-400 text-xs">
                      Joined {new Date(member.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {member.status === "pending" && (
                    <button
                      onClick={() => copyInviteLink(member)}
                      className="text-slate-400 hover:text-blue-600 text-xs truncate max-w-[220px] text-left transition-colors"
                    >
                      {copiedId === member.id ? "Copied invite link!" : `Copy invite link`}
                    </button>
                  )}
                </div>

                <div className="shrink-0 ml-3 flex items-center gap-3">
                  {/* Role selector for active members — owner only (manage_roles). */}
                  {member.status === "active" && caps.canManageRoles && (
                    <select
                      value={member.role && ROLE_LABELS[member.role] ? member.role : "employee"}
                      onChange={(e) => changeRole(member.id, e.target.value)}
                      disabled={roleSavingId === member.id}
                      className="text-xs bg-[#FAF7F2] border border-[#D4C8B8] rounded-lg px-2 py-1 text-slate-700 focus:outline-none disabled:opacity-40"
                      aria-label={`Role for ${member.invite_email}`}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="billing_admin">Billing Admin</option>
                    </select>
                  )}
                  {member.status === "active" && !caps.canManageRoles && member.role && ROLE_LABELS[member.role] && member.role !== "employee" && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-[#F0EBE1] px-2 py-0.5 rounded-full">{ROLE_LABELS[member.role]}</span>
                  )}
                  {member.status === "pending" && caps.canInvite && (
                    <button
                      onClick={() => resendInvite(member.invite_email)}
                      disabled={resendingEmail === member.invite_email}
                      className="text-xs text-blue-600 hover:text-blue-500 transition-colors disabled:opacity-40"
                    >
                      {resendingEmail === member.invite_email ? "…" : expired ? "Re-invite" : "Resend"}
                    </button>
                  )}
                  {caps.canRemove && (
                  <button
                    onClick={() => removeMember(member.id)}
                    disabled={removingId === member.id}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {removingId === member.id ? "…" : member.status === "pending" ? "Revoke" : "Remove"}
                  </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
