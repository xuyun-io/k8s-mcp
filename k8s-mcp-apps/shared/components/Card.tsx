import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  onClick?: () => void;
}

export const Card = React.memo<Props>(({
  children,
  className = "",
  padding = "md",
  hover = false,
  onClick,
}) => {
  const pad = padding === "none" ? 0 : padding === "sm" ? 12 : padding === "lg" ? 24 : 16;

  return (
    <div
      className={`k8s-card ${hover ? "k8s-card-hover" : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
      <style>{`
        .k8s-card {
          background: var(--glassBg);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glassBorder);
          border-top: 1px solid var(--glassBorderHighlight);
          box-shadow: var(--glassShadow);
          border-radius: 16px;
          padding: ${pad}px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .k8s-card-hover {
          cursor: pointer;
        }
        .k8s-card-hover:hover {
          border-color: var(--borderHover);
          box-shadow: 0 0 0 1px var(--borderHover), 0 12px 40px rgba(0,0,0,0.25);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
});
Card.displayName = "Card";
