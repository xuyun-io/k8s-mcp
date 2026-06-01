import React, { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render?: (item: T, index: number) => React.ReactNode;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  sortable?: boolean;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
}

type SortDir = "asc" | "desc";

export const Table = React.memo(<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  loading,
  emptyMessage = "No data",
  sortable = true,
  onRowClick,
  rowClassName,
}: Props<T>): React.ReactElement => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    if (!sortKey || !sortable) return data;
    return data.toSorted((a: T, b: T) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, sortable]);

  const handleSort = (col: Column<T>) => {
    if (!sortable || col.sortable === false) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("desc");
    }
  };

  return (
    <div className="k8s-table-wrap">
      <table className="k8s-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${sortable && col.sortable !== false ? "sortable" : ""} ${
                  sortKey === col.key ? `sorted-${sortDir}` : ""
                }`}
                style={{ width: col.width, textAlign: col.align || "left" }}
                onClick={() => handleSort(col)}
              >
                <span className="k8s-table-header-inner">
                  {col.header}
                  {sortKey === col.key && (
                    <span className="k8s-table-sort-icon">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="k8s-table-empty">
                <span className="k8s-table-spinner" />
                Loading...
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="k8s-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((item: T, idx: number) => (
              <tr
                key={keyExtractor(item)}
                className={[onRowClick ? "clickable" : "", rowClassName?.(item) || ""].filter(Boolean).join(" ")}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || "left" }}
                  >
                    {col.render
                      ? col.render(item, idx)
                      : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <style>{`
        .k8s-table-wrap {
          overflow-x: auto;
          border-radius: 10px;
          border: 1px solid var(--border);
        }
        .k8s-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .k8s-table th {
          padding: 10px 12px;
          background: var(--bgOverlay);
          color: var(--textSecondary);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid var(--borderStrong);
          white-space: nowrap;
          user-select: none;
          position: relative;
        }
        .k8s-table th.sortable {
          cursor: pointer;
        }
        .k8s-table th.sortable:hover {
          color: var(--text);
        }
        .k8s-table th.sorted-asc,
        .k8s-table th.sorted-desc {
          color: var(--accent);
        }
        .k8s-table-header-inner {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .k8s-table-sort-icon {
          font-size: 9px;
          opacity: 0.8;
        }
        .k8s-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          vertical-align: middle;
        }
        .k8s-table tbody tr:last-child td {
          border-bottom: none;
        }
        .k8s-table tbody tr.clickable {
          cursor: pointer;
        }
        .k8s-table tbody tr:hover td {
          background: var(--bgHover);
        }
        .k8s-table-empty {
          text-align: center;
          padding: 40px 20px !important;
          color: var(--textMuted);
        }
        .k8s-table-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid var(--borderStrong);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: k8s-spin 0.8s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}) as <T extends Record<string, unknown>>(props: Props<T>) => React.ReactElement;
(Table as unknown as { displayName?: string }).displayName = "Table";
