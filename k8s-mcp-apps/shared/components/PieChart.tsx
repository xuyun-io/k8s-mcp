import React from "react";

interface Slice {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
}

export const PieChart = React.memo<Props>(({ data, size = 140 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="var(--border)" />
      </svg>
    );
  }

  let startAngle = -Math.PI / 2;
  const paths: React.ReactElement[] = [];

  data.forEach((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    const x2 = 50 + 40 * Math.cos(startAngle + angle);
    const y2 = 50 + 40 * Math.sin(startAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    paths.push(
      <path
        key={i}
        d={`M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A40,40 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
        fill={d.color}
        stroke="var(--bgBase)"
        strokeWidth={2}
      />
    );
    startAngle += angle;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
    >
      {paths}
    </svg>
  );
});
PieChart.displayName = "PieChart";
