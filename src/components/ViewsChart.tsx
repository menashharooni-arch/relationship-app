"use client";

import { useState } from "react";

type DayData = { date: string; views: number };

export default function ViewsChart({ data }: { data: DayData[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.views), 1);
  const W = 600;
  const H = 80;
  const gap = 2;
  const barW = W / data.length - gap;

  function fmt(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H + 4}`}
        className="w-full overflow-visible"
        style={{ height: 80 }}
      >
        {data.map((d, i) => {
          const barH = d.views > 0 ? Math.max((d.views / max) * H, 4) : 2;
          const x = i * (W / data.length);
          const y = H - barH;
          const isHov = hovered === i;
          const isToday = i === data.length - 1;

          return (
            <g key={d.date}>
              <rect
                x={x + gap / 2}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                fill={
                  d.views === 0
                    ? "#1f2937"
                    : isHov || isToday
                    ? "#2563eb"
                    : "#3b82f6"
                }
                style={{ transition: "fill 0.1s", cursor: "default" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {isHov && d.views > 0 && (
                <>
                  <rect
                    x={x + gap / 2 - 16}
                    y={y - 24}
                    width={barW + 32}
                    height={18}
                    rx={4}
                    fill="#1e293b"
                  />
                  <text
                    x={x + barW / 2 + gap / 2}
                    y={y - 11}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight={700}
                  >
                    {d.views} view{d.views !== 1 ? "s" : ""}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex justify-between mt-1" style={{ fontSize: 10, color: "#94a3b8" }}>
        <span>{fmt(data[0].date)}</span>
        {hovered !== null ? (
          <span style={{ color: "#2563eb", fontWeight: 600 }}>{fmt(data[hovered].date)}</span>
        ) : (
          <span>Today</span>
        )}
      </div>
    </div>
  );
}
