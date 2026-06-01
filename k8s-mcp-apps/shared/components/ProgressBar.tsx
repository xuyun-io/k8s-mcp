import React from "react";

interface Props {
  value: number;
  max?: number;
  color?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  label?: string;
}

export const ProgressBar = React.memo<Props>(({
  value,
  max = 100,
  color,
  size = "md",
  showLabel = true,
  label,
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const height = size === "sm" ? 6 : 10;
  const barColor = color || "var(--accent)";

  return (
    <div className="k8s-progress">
      <div className="k8s-progress-track" style={{ height }}>
        <div
          className="k8s-progress-fill"
          style={{
            width: `${pct}%`,
            background: barColor,
            height,
          }}
        />
      </div>
      {showLabel && (
        <span className="k8s-progress-label">
          {label || `${pct.toFixed(0)}%`}
        </span>
      )}
      <style>{`
        .k8s-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .k8s-progress-track {
          flex: 1;
          background: var(--bgOverlay);
          border-radius: 999px;
          overflow: hidden;
          min-width: 40px;
        }
        .k8s-progress-fill {
          border-radius: 999px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .k8s-progress-label {
          font-size: 11px;
          color: var(--textMuted);
          font-variant-numeric: tabular-nums;
          min-width: 32px;
          text-align: right;
        }
      `}</style>
    </div>
  );
});
ProgressBar.displayName = "ProgressBar";
