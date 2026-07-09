import Link from "next/link";

// Dashboard banner shown while an account is on an app-level Pro grant (the
// 14-day reverse trial, or a stacked referral/free month). Presentational only —
// the dashboard decides when to render it and passes the computed days left.
export default function TrialBanner({ daysLeft, isTrial }: { daysLeft: number; isTrial: boolean }) {
  const urgent = daysLeft <= 3;
  const label = isTrial ? "You're on a free Pro trial" : "You're on free Pro";
  const days = daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 mb-5 border flex-wrap"
      style={
        urgent
          ? { background: "rgba(180,83,9,0.12)", borderColor: "rgba(180,83,9,0.4)" }
          : { background: "rgba(37,99,235,0.10)", borderColor: "rgba(37,99,235,0.35)" }
      }
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base shrink-0">{urgent ? "⏳" : "⚡"}</span>
        <p className={`text-sm font-medium ${urgent ? "text-amber-300" : "text-blue-200"}`}>
          {label} — <span className="font-bold">{days}</span>
          <span className="hidden sm:inline text-gray-400 font-normal">
            {" "}· then you move to Free. Nothing gets deleted.
          </span>
        </p>
      </div>
      <Link
        href="/pricing"
        className={`shrink-0 text-xs font-bold px-4 py-2 rounded-full text-white transition-colors ${
          urgent ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"
        }`}
      >
        Keep Pro →
      </Link>
    </div>
  );
}
