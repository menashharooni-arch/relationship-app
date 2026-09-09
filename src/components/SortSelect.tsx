"use client";

export default function SortSelect({ value }: { value: string }) {
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const url = new URL(window.location.href);
    url.searchParams.set("sort", e.target.value);
    window.location.href = url.toString();
  }

  return (
    <select
      // Its meaning comes from the list beside it, so on its own VoiceOver read
      // "pop-up button" with no name and Voice Control had nothing to say.
      aria-label="Sort contacts"
      defaultValue={value}
      onChange={onChange}
      className="text-xs bg-gray-900 border border-gray-700 text-gray-400 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
    >
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="name-asc">Name A–Z</option>
      <option value="name-desc">Name Z–A</option>
    </select>
  );
}
