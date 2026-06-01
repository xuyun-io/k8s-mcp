import React, { useMemo, useState, useCallback } from "react";
import type { InspectReport, NamespaceItem, ViewerState, TableSort } from "../types";
import { currentNamespaces, formatCpu, formatBytes, TABLE_COLUMNS } from "../utils";
import { Table, Card } from "../../../shared/components";
import type { Column } from "../../../shared/components";
import { CircleCheck, CirclePause, Minus } from "lucide-react";

interface Props {
  report: InspectReport;
  state: ViewerState;
  onRowClick?: (ns: NamespaceItem) => void;
}

function compareValues(a: unknown, b: unknown, type: string): number {
  if (type === "string") {
    const sa = String(a || "").toLowerCase();
    const sb = String(b || "").toLowerCase();
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }
  if (type === "bytes" || type === "cpu" || type === "number") {
    return (a as number || 0) - (b as number || 0);
  }
  if (type === "cronjob") {
    return ((a as unknown[]) || []).length - ((b as unknown[]) || []).length;
  }
  return 0;
}

function sortNamespaces(rows: NamespaceItem[], column: string, asc: boolean): NamespaceItem[] {
  const colConfig = TABLE_COLUMNS[column];
  if (!colConfig) return rows;
  return rows.slice().sort((a, b) => {
    let va: unknown, vb: unknown;
    if (column === "ivs") { va = a.ivs || ""; vb = b.ivs || ""; }
    else if (column === "product") { va = a.product || ""; vb = b.product || ""; }
    else if (column === "cronjobs") { va = a.cronjobs || []; vb = b.cronjobs || []; }
    else { va = (a as Record<string, unknown>)[column]; vb = (b as Record<string, unknown>)[column]; }
    const cmp = compareValues(va, vb, colConfig.type);
    return asc ? cmp : -cmp;
  });
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: 48, height: 4, borderRadius: 2, background: "rgba(148,163,184,0.22)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: color, transition: "width 0.3s ease" }} />
    </div>
  );
}



export const NamespaceTable: React.FC<Props> = ({ report, state, onRowClick }) => {
  const rows = currentNamespaces(report.namespaces, state);
  const [sort, setSort] = useState<TableSort>({ column: "cpu", asc: false });

  const sortedRows = useMemo(() => sortNamespaces(rows, sort.column, sort.asc), [rows, sort]);

  const handleSort = useCallback((col: string) => {
    setSort((prev) => ({ column: col, asc: prev.column === col ? !prev.asc : false }));
  }, []);
  void handleSort;

  const maxCpu = useMemo(() => Math.max(...rows.map((r) => r.cpu || 0), 1), [rows]);
  const maxMemory = useMemo(() => Math.max(...rows.map((r) => r.memory || 0), 1), [rows]);
  const maxStorage = useMemo(() => Math.max(...rows.map((r) => r.storage || 0), 1), [rows]);

  const columns: Column<NamespaceItem>[] = [
    {
      key: "name",
      header: "Namespace",
      width: "160px",
      render: (ns) => <span style={{ fontWeight: 600 }}>{ns.name}</span>,
    },
    {
      key: "ivs",
      header: "Labels",
      width: "140px",
      sortable: false,
      render: (ns) => (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {ns.ivs ? <span className="ns-label ns-label-ivs">{ns.ivs}</span> : null}
          {ns.product ? <span className="ns-label ns-label-product">{ns.product}</span> : null}
          {!ns.ivs && !ns.product && (
            <span style={{ color: "var(--error)", fontStyle: "italic", fontSize: 11 }}>未标注</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "80px",
      render: (ns) => {
        const s = ns.status;
        if (!s) {
          return (
            <span className="ns-status-badge ns-status-none">
              <Minus size={11} />—
            </span>
          );
        }
        const isActive = s === "active";
        return (
          <span className={`ns-status-badge ${isActive ? "ns-status-active" : "ns-status-idle"}`}>
            {isActive ? <CircleCheck size={11} /> : <CirclePause size={11} />}
            {isActive ? "Active" : "Idle"}
          </span>
        );
      },
    },
    {
      key: "cpu",
      header: "CPU",
      align: "right",
      width: "80px",
      render: (ns) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{formatCpu(ns.cpu)}</span>
          <MiniBar value={ns.cpu || 0} max={maxCpu} color="var(--cpu)" />
        </div>
      ),
    },
    {
      key: "memory",
      header: "Memory",
      align: "right",
      width: "80px",
      render: (ns) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{formatBytes(ns.memory)}</span>
          <MiniBar value={ns.memory || 0} max={maxMemory} color="var(--memory)" />
        </div>
      ),
    },
    {
      key: "storage",
      header: "Storage",
      align: "right",
      width: "80px",
      render: (ns) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{formatBytes(ns.storage)}</span>
          <MiniBar value={ns.storage || 0} max={maxStorage} color="var(--storage)" />
        </div>
      ),
    },
    { key: "pods", header: "Pods", align: "right", width: "50px" },
    { key: "pvcs", header: "PVCs", align: "right", width: "50px" },
    { key: "ingresses", header: "Ing", align: "right", width: "50px" },
    { key: "configmaps", header: "CM", align: "right", width: "50px" },
    { key: "secrets", header: "Sec", align: "right", width: "50px" },
    { key: "cronjobs", header: "CJ", align: "right", width: "50px", render: (ns) => <span style={{ fontSize: 12 }}>{(ns.cronjobs || []).length}</span> },
  ];

  return (
    <section id="full-list" style={{ marginTop: 22 }}>
      <Card padding="md">
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 12 }}>⑥ 完整列表</div>
        <Table
          data={sortedRows as Array<Record<string, unknown>>}
          columns={columns as Array<Column<Record<string, unknown>>>}
          keyExtractor={(ns) => (ns as NamespaceItem).name}
          emptyMessage="No namespaces found"
          sortable={true}
          onRowClick={(row) => onRowClick?.(row as NamespaceItem)}
          rowClassName={() => onRowClick ? "clickable" : ""}
        />
      </Card>
      <style>{`
        .ns-label {
          display: inline-flex;
          align-items: center;
          padding: 1px 7px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .ns-label-ivs {
          color: var(--info);
          background: var(--infoBg);
          border: 1px solid rgba(56, 189, 248, 0.25);
        }
        .ns-label-product {
          color: var(--accent);
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        .ns-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .ns-status-active {
          color: var(--success);
          background: var(--successBg);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        .ns-status-idle {
          color: var(--warning);
          background: var(--warningBg);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .ns-status-none {
          color: var(--textSecondary);
          background: var(--bgOverlay);
          border: 1px solid var(--border);
        }
      `}</style>
    </section>
  );
};
