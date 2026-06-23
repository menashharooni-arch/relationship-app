"use client";

export default function SortSelect({ value }: { value: string }) {
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const url = new URL(window.location.href);
    url.searchParams.set("sort", e.target.value);
    window.location.href = url.toString();
  }

  return (
    <select
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
