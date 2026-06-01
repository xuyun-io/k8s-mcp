import React from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "cpu"
  | "memory"
  | "storage";

interface Props {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

function alphaColor(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith("rgb(")) {
    return color.replace(")", `, ${alpha})`);
  }
  if (color.startsWith("rgba(")) {
    return color.replace(/,\s*[\d.]+\)/, `, ${alpha})`);
  }
  return color;
}

export const Badge = React.memo<Props>(({ children, variant = "default", dot }) => {
  const variants: Record<BadgeVariant, { color: string; bg: string }> = {
    default: { color: "var(--textSecondary)", bg: "var(--bgOverlay)" },
    success: { color: "var(--success)", bg: "var(--successBg)" },
    warning: { color: "var(--warning)", bg: "var(--warningBg)" },
    error: { color: "var(--error)", bg: "var(--errorBg)" },
    info: { color: "var(--info)", bg: "var(--infoBg)" },
    cpu: { color: "var(--cpu)", bg: "var(--cpuBg)" },
    memory: { color: "var(--memory)", bg: "var(--memoryBg)" },
    storage: { color: "var(--storage)", bg: "var(--storageBg)" },
  };

  const v = variants[variant];

  return (
    <span className="k8s-badge">
      {dot && <span className="k8s-badge-dot" />}
      {children}
      <style>{`
        .k8s-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: ${v.color};
          background: ${v.bg};
          border: 1px solid ${alphaColor(v.color, 0.25)};
          white-space: nowrap;
        }
        .k8s-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
      `}</style>
    </span>
  );
});
Badge.displayName = "Badge";
