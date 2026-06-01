import React, { useMemo } from "react";
import type { InspectReport } from "../types";
import { Card, Badge } from "../../../shared/components";

interface Props {
  report: InspectReport;
}

export const CronjobPanel: React.FC<Props> = ({ report }) => {
  const stats = useMemo(() => {
    let total = 0;
    let active = 0;
    let suspended = 0;
    report.namespaces.forEach((ns) => {
      (ns.cronjobs || []).forEach((cj) => {
        total++;
        if (cj.suspend) {
          suspended++;
        } else {
          active++;
        }
      });
    });
    return { total, active, suspended };
  }, [report.namespaces]);

  if (stats.total === 0) {
    return (
      <section id="cronjobs" style={{ marginTop: 22 }}>
        <Card padding="md">
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 12 }}>
            ⑤ 定时任务
          </div>
          <div style={{ color: "var(--textMuted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            集群中没有定时任务
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section id="cronjobs" style={{ marginTop: 22 }}>
      <Card padding="md">
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 12 }}>
          ⑤ 定时任务
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{
            flex: 1, minWidth: 120, padding: 14, borderRadius: 10,
            background: "var(--bgBase)", border: "1px solid var(--border)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: "var(--textMuted)", marginTop: 4 }}>总计</div>
          </div>
          <div style={{
            flex: 1, minWidth: 120, padding: 14, borderRadius: 10,
            background: "var(--bgBase)", border: "1px solid var(--border)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>{stats.active}</div>
            <div style={{ fontSize: 12, color: "var(--textMuted)", marginTop: 4 }}>
              <Badge variant="success" dot>有效</Badge>
            </div>
          </div>
          <div style={{
            flex: 1, minWidth: 120, padding: 14, borderRadius: 10,
            background: "var(--bgBase)", border: "1px solid var(--border)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: stats.suspended > 0 ? "var(--warning)" : "var(--textMuted)" }}>
              {stats.suspended}
            </div>
            <div style={{ fontSize: 12, color: "var(--textMuted)", marginTop: 4 }}>
              <Badge variant={stats.suspended > 0 ? "warning" : "default"} dot>暂停</Badge>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};
