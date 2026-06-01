import React from "react";

interface NavItem {
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  title: string;
  items: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}

export const Sidebar = React.memo<Props>(({ title, items, activeId, onNavigate }) => {
  return (
    <nav className="k8s-sidebar">
      <h3 className="k8s-sidebar-title">{title}</h3>
      <ul className="k8s-sidebar-nav">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={activeId === item.id ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.id);
              }}
            >
              <span className="k8s-nav-label">{item.label}</span>
              {item.sub && <span className="k8s-nav-sub">{item.sub}</span>}
            </a>
          </li>
        ))}
      </ul>
      <style>{`
        .k8s-sidebar {
          width: 230px;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          border-right: 1px solid var(--border);
          background: var(--bgElevated);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .k8s-sidebar-title {
          margin: 0;
          font-size: 11px;
          font-weight: 800;
          color: var(--textMuted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .k8s-sidebar-nav {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .k8s-sidebar-nav a {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 8px 10px;
          border-radius: 8px;
          color: var(--textSecondary);
          font-size: 13px;
          text-decoration: none;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .k8s-sidebar-nav a:hover {
          background: var(--bgHover);
          color: var(--text);
        }
        .k8s-sidebar-nav a.active {
          background: var(--accentBg);
          border-color: var(--accent);
          color: var(--accent);
        }
        .k8s-nav-label {
          font-weight: 600;
        }
        .k8s-nav-sub {
          font-size: 11px;
          color: var(--textMuted);
          font-weight: 400;
        }
        .k8s-sidebar-nav a.active .k8s-nav-sub {
          color: var(--accent);
          opacity: 0.7;
        }
      `}</style>
    </nav>
  );
});
Sidebar.displayName = "Sidebar";
