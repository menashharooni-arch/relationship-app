import CopyButton from "@/components/CopyButton";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function ReferAFriend({ username }: { username: string }) {
  const link = `${APP_URL}/login?mode=signup&ref=${username}`;
  return (
    <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
      <p className="text-gray-200 text-sm font-medium mb-1">Refer a friend</p>
      <p className="text-gray-500 text-xs mb-3 leading-relaxed">
        Know someone who networks a lot? Share SwiftCard — if they sign up, you&apos;re helping a friend level up their game.
      </p>
      <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 mb-2">
        <p className="text-gray-400 text-[11px] font-mono break-all">{link}</p>
      </div>
      <CopyButton text={link} />
    </div>
  );
}
