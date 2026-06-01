import React from "react";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = React.memo<Props>(({ label, className = "", children, ...rest }) => {
  return (
    <label className={`k8s-select-wrap ${className}`}>
      {label && <span className="k8s-select-label">{label}</span>}
      <div className="k8s-select-inner">
        <select className="k8s-select" {...rest}>
          {children}
        </select>
        <svg className="k8s-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <style>{`
        .k8s-select-wrap {
          display: grid;
          gap: 5px;
        }
        .k8s-select-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--textMuted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .k8s-select-inner {
          position: relative;
          display: flex;
          align-items: center;
        }
        .k8s-select {
          appearance: none;
          width: 100%;
          height: 34px;
          padding: 0 28px 0 10px;
          border-radius: 8px;
          border: 1px solid var(--borderStrong);
          background: var(--bgElevated);
          color: var(--text);
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
          outline: none;
        }
        .k8s-select:hover {
          border-color: var(--borderHover);
        }
        .k8s-select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accentBg);
        }
        .k8s-select-arrow {
          position: absolute;
          right: 8px;
          width: 14px;
          height: 14px;
          color: var(--textMuted);
          pointer-events: none;
        }
      `}</style>
    </label>
  );
});
Select.displayName = "Select";
