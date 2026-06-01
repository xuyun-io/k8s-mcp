import React, { useMemo } from "react";
import type { InspectReport, ViewerState } from "../types";
import { currentGroups, COLORS, pct } from "../utils";
import { PieChart, Card } from "../../../shared/components";

interface Props {
  report: InspectReport;
  state: ViewerState;
}

export const DistributionPies: React.FC<Props> = ({ report, state }) => {
  const all = useMemo(() => currentGroups(report.namespaces, state), [report.namespaces, state]);

  const configs = useMemo(() => [
    { title: "CPU Request 分布", key: "cpu" as const, colorOffset: 0 },
    { title: "Memory Request 分布", key: "memory" as const, colorOffset: 2 },
    { title: "Storage Request 分布", key: "storage" as const, colorOffset: 4 },
  ], []);

  const pies = useMemo(() => {
    return configs.map((cfg) => {
      const sorted = all.slice().sort((a, b) => b[cfg.key] - a[cfg.key]);
      const top = sorted.slice(0, 5);
      const other = sorted.slice(5).reduce((s, g) => s + g[cfg.key], 0);
      const data = top.map((g) => ({ name: g.name, value: g[cfg.key], color: "" }));
      if (other > 0) data.push({ name: "其他", value: other, color: "" });
      const colors = COLORS.slice(cfg.colorOffset, cfg.colorOffset + 6);
      data.forEach((d, i) => { d.color = colors[i % colors.length]; });
      return { title: cfg.title, data };
    });
  }, [all, configs]);

  return (
    <section id="distribution" style={{ marginTop: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {pies.map((p, i) => (
          <Card key={i} padding="md">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 14, textAlign: "center" }}>
              {p.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <PieChart data={p.data} size={130} />
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                {p.data.map((d, j) => (
                  <span key={j} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--textSecondary)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    {d.name} <strong style={{ color: "var(--text)" }}>{pct(d.value, p.data.reduce((s, x) => s + x.value, 0)).toFixed(1)}%</strong>
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
