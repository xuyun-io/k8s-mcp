import React, { useMemo } from "react";
import type { InspectReport, ViewerState } from "../types";
import { sum, pct, METRIC_META } from "../utils";
import { Card, ProgressBar } from "../../../shared/components";

interface Props {
  report: InspectReport;
  state: ViewerState;
}

export const CoveragePanel: React.FC<Props> = ({ report, state }) => {
  const ns = report.namespaces;
  const dims = useMemo(() => [
    { key: "ivs" as const, label: "kubestar.io/ivs", color: "#f59e0b" },
    { key: "product" as const, label: "kubestar.io/product", color: "#a78bfa" },
  ], []);

  return (
    <section id="coverage" style={{ marginTop: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {dims.map((dim) => {
          const total = ns.length;
          const tagged = ns.filter((n) => (dim.key === "ivs" ? !!n.ivs : !!n.product));
          const missing = total - tagged.length;
          const taggedTotals = sum(tagged);
          const allTotals = sum(ns);
          const meta = METRIC_META[state.metric];
          const share = pct(taggedTotals[state.metric], allTotals[state.metric]);
          const taggedPct = total > 0 ? (tagged.length / total) * 100 : 0;

          return (
            <Card key={dim.key} padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>
                {dim.label}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--textMuted)", marginBottom: 8 }}>
                <span>已标注 namespace：{tagged.length}/{total}</span>
                <span>未标注：{missing}</span>
              </div>
              <ProgressBar value={taggedPct} color={dim.color} size="sm" showLabel={false} />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--textSecondary)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dim.color }} />
                  已标注 {tagged.length}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--textMuted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#475569" }} />
                  未标注 {missing}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--textMuted)", marginTop: 10 }}>
                <span>{meta.label} 已归属：{share.toFixed(1)}%</span>
                <span style={{ color: "var(--textSecondary)", fontWeight: 600 }}>{meta.fmt(taggedTotals[state.metric])}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
