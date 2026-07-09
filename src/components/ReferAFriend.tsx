import CopyButton from "@/components/CopyButton";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function ReferAFriend({ code, rewardEarned }: { code: string | null; rewardEarned: boolean }) {
  const link = code ? `${APP_URL}/r/${code}` : null;
  return (
    <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
      <p className="text-gray-200 text-sm font-medium mb-1">Refer a friend</p>
      <p className="text-gray-500 text-xs mb-3 leading-relaxed">
        Share your link — your friend gets <strong className="text-gray-300">1 month of Pro free</strong>. When one of them upgrades to Pro, you get <strong className="text-gray-300">1 free month too</strong> (once).
      </p>

      {link ? (
        <>
          <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 mb-2">
            <p className="text-blue-400 text-[12px] font-mono break-all">{link.replace(/^https?:\/\//, "")}</p>
          </div>
          <CopyButton text={link} />
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${rewardEarned ? "bg-emerald-500" : "bg-gray-600"}`} />
            <p className="text-xs text-gray-500">
              {rewardEarned
                ? <span className="text-emerald-400">You&apos;ve earned your free month — thanks for spreading the word!</span>
                : "Reward not earned yet — it unlocks the first time a friend upgrades to Pro."}
            </p>
          </div>
        </>
      ) : (
        <p className="text-gray-600 text-xs">Your referral link will appear here once setup finishes.</p>
      )}
    </div>
  );
}
