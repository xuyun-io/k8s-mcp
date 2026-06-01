import React from "react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
}

export const MetricCard = React.memo<Props>(({ label, value, hint, highlight }) => {
  return (
    <div className={`k8s-metric-card${highlight ? " highlight" : ""}`}>
      <span className="k8s-metric-label">{label}</span>
      <strong className="k8s-metric-value">{value}</strong>
      {hint && <small className="k8s-metric-hint">{hint}</small>}
      <style>{`
        .k8s-metric-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 16px;
          background: var(--glassBg);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glassBorder);
          border-top: 1px solid var(--glassBorderHighlight);
          box-shadow: var(--glassShadow);
          border-radius: 16px;
          min-height: 86px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .k8s-metric-card:hover {
          border-color: var(--borderHover);
          box-shadow: 0 0 0 1px var(--borderHover), 0 12px 40px rgba(0,0,0,0.25);
          transform: translateY(-2px);
        }
        .k8s-metric-card.highlight {
          border-color: var(--accent);
          background: var(--accentBg);
        }
        .k8s-metric-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--textMuted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .k8s-metric-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.15;
          font-variant-numeric: tabular-nums;
        }
        .k8s-metric-hint {
          font-size: 11px;
          color: var(--textMuted);
        }
      `}</style>
    </div>
  );
});
MetricCard.displayName = "MetricCard";
