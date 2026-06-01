import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button = React.memo<Props>(({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  children,
  className = "",
  disabled,
  ...rest
}) => {
  const height = size === "sm" ? 28 : size === "lg" ? 40 : 32;
  const padX = size === "sm" ? 10 : size === "lg" ? 16 : 12;
  const fontSize = size === "sm" ? 12 : size === "lg" ? 15 : 13;

  const variantStyles: Record<ButtonVariant, string> = {
    primary: `
      background: var(--accent);
      color: var(--textInverse);
      border: 1px solid transparent;
    `,
    secondary: `
      background: var(--bgElevated);
      color: var(--textSecondary);
      border: 1px solid var(--borderStrong);
    `,
    ghost: `
      background: transparent;
      color: var(--textSecondary);
      border: 1px solid transparent;
    `,
    danger: `
      background: var(--errorBg);
      color: var(--error);
      border: 1px solid transparent;
    `,
  };

  return (
    <button
      className={`k8s-btn ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="k8s-btn-spinner" />}
      {icon && !loading && <span className="k8s-btn-icon">{icon}</span>}
      {children}
      <style>{`
        .k8s-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: ${height}px;
          padding: 0 ${padX}px;
          border-radius: 8px;
          font-size: ${fontSize}px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          ${variantStyles[variant]}
        }
        .k8s-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.15);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .k8s-btn:active:not(:disabled) {
          transform: translateY(0);
          filter: brightness(0.95);
        }
        .k8s-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .k8s-btn-icon {
          display: flex;
          align-items: center;
          font-size: ${fontSize + 2}px;
        }
        .k8s-btn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: k8s-spin 0.8s linear infinite;
        }
        @keyframes k8s-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
});
Button.displayName = "Button";
