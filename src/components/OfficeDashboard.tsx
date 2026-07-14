"use client";

import { useState } from "react";

type Member = {
  id: string;
  invite_email: string;
  invite_token: string;
  status: string;
  role: string;
  joined_at: string | null;
  user_id: string | null;
};

type Office = {
  id: string;
  name: string;
  seats: number;
};

export default function OfficeDashboard({
  office,
  members,
  appUrl,
}: {
  office: Office;
  members: Member[];
  appUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteError, setInviteError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [memberList, setMemberList] = useState<Member[]>(members);

  const activeCount = memberList.filter((m) => m.status === "active").length;
  const pendingCount = memberList.filter((m) => m.status === "pending").length;
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
      setInviteError(json.error ?? "Failed to send invite.");
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
      setMemberList((prev) => prev.filter((m) => m.id !== memberId));
    }
    setRemovingId(null);
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

      {/* Invite form */}
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

      {/* Member list */}
      <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-4">
          Members ({memberList.length})
        </p>

        {memberList.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No members yet. Send your first invite above.</p>
        ) : (
          <div className="space-y-2">
            {memberList.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-[#F0EBE1] rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-slate-900 text-sm font-medium truncate">{member.invite_email}</p>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: member.status === "active" ? "#dcfce7" : "#fef9c3",
                        color: member.status === "active" ? "#15803d" : "#854d0e",
                      }}
                    >
                      {member.status === "active" ? "Active" : "Pending"}
                    </span>
                  </div>
                  {member.status === "active" && member.joined_at && (
                    <p className="text-slate-400 text-xs">
                      Joined {new Date(member.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {member.status === "pending" && (
                    <p className="text-slate-400 text-xs truncate max-w-[200px]">
                      Invite: {appUrl}/join/{member.invite_token}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeMember(member.id)}
                  disabled={removingId === member.id}
                  className="shrink-0 ml-3 text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  {removingId === member.id ? "…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
