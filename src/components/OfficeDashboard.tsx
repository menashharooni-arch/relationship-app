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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Office</p>
            <h2 className="text-xl font-bold text-white">{office.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{activeCount} <span className="text-gray-500 text-base font-normal">/ {office.seats}</span></p>
            <p className="text-gray-500 text-xs mt-0.5">active seats</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-800">
          {[
            { label: "Active", value: activeCount, color: "#86efac" },
            { label: "Pending", value: pendingCount, color: "#fcd34d" },
            { label: "Seats left", value: Math.max(0, office.seats - activeCount), color: "#93c5fd" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-gray-600 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Invite a team member</p>
        <form onSubmit={sendInvite} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={inviteStatus === "sending" || activeCount >= office.seats}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {inviteStatus === "sending" ? "Sending…" : inviteStatus === "sent" ? "Sent!" : "Send invite"}
          </button>
        </form>
        {inviteStatus === "error" && <p className="text-red-400 text-xs mt-2">{inviteError}</p>}
        {activeCount >= office.seats && (
          <p className="text-yellow-400 text-xs mt-2">Seat limit reached. Contact support to add more seats.</p>
        )}
      </div>

      {/* Member list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">
          Members ({memberList.length})
        </p>

        {memberList.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No members yet. Send your first invite above.</p>
        ) : (
          <div className="space-y-2">
            {memberList.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-gray-950 rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white text-sm font-medium truncate">{member.invite_email}</p>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: member.status === "active" ? "#14532d" : "#78350f",
                        color: member.status === "active" ? "#86efac" : "#fcd34d",
                      }}
                    >
                      {member.status === "active" ? "Active" : "Pending"}
                    </span>
                  </div>
                  {member.status === "active" && member.joined_at && (
                    <p className="text-gray-600 text-xs">
                      Joined {new Date(member.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {member.status === "pending" && (
                    <p className="text-gray-600 text-xs">
                      Invite: <span className="text-gray-500">{appUrl}/join/{member.invite_token}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeMember(member.id)}
                  disabled={removingId === member.id}
                  className="shrink-0 ml-3 text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
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
