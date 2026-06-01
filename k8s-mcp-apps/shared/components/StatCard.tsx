import React from "react";

interface Props {
  icon: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  warning?: boolean;
}

export const StatCard = React.memo<Props>(({
  icon,
  iconColor = "var(--accent)",
  iconBg = "var(--accentBg)",
  label,
  value,
  unit,
  sub,
  warning,
}) => {
  return (
    <div className="k8s-stat-card">
      <div className="k8s-stat-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="k8s-stat-body">
        <div className="k8s-stat-label">{label}</div>
        <div className="k8s-stat-number">
          <span className="k8s-stat-value">{value}</span>
          {unit && <span className="k8s-stat-unit">{unit}</span>}
        </div>
        {sub && (
          <div className={`k8s-stat-sub${warning ? " warning" : ""}`}>{sub}</div>
        )}
      </div>
      <style>{`
        .k8s-stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
          background: var(--glassBg);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glassBorder);
          border-top: 1px solid var(--glassBorderHighlight);
          box-shadow: var(--glassShadow);
          border-radius: 16px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          min-height: 100px;
        }
        .k8s-stat-card:hover {
          border-color: var(--borderHover);
          box-shadow: 0 0 0 1px var(--borderHover), 0 12px 40px rgba(0,0,0,0.25);
          transform: translateY(-2px);
        }
        .k8s-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
        }
        .k8s-stat-icon > svg {
          width: 22px;
          height: 22px;
        }
        .k8s-stat-body {
          min-width: 0;
          flex: 1;
        }
        .k8s-stat-label {
          font-size: 12px;
          color: var(--textMuted);
          font-weight: 600;
          margin-bottom: 4px;
          letter-spacing: 0.02em;
        }
        .k8s-stat-number {
          display: flex;
          align-items: baseline;
          gap: 5px;
          line-height: 1.2;
        }
        .k8s-stat-value {
          font-size: 26px;
          font-weight: 700;
          color: var(--text);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .k8s-stat-unit {
          font-size: 13px;
          font-weight: 600;
          color: var(--textSecondary);
        }
        .k8s-stat-sub {
          font-size: 11px;
          color: var(--textMuted);
          margin-top: 3px;
        }
        .k8s-stat-sub.warning {
          color: var(--error);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
});
StatCard.displayName = "StatCard";
