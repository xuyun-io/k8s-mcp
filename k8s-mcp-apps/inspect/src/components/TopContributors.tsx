import React, { useMemo } from "react";
import type { InspectReport, ViewerState } from "../types";
import { currentNamespaces, sum, currentGroups, pct, formatCpu, formatBytes, METRIC_META } from "../utils";
import { Card } from "../../../shared/components";

interface Props {
  report: InspectReport;
  state: ViewerState;
  onSelect: (name: string) => void;
}

export const TopContributors: React.FC<Props> = ({ report, state, onSelect }) => {
  const all = useMemo(() => currentGroups(report.namespaces, state), [report.namespaces, state]);
  const list = useMemo(() => (state.topn >= 999 ? all : all.slice(0, state.topn)), [all, state.topn]);
  const totals = useMemo(() => sum(currentNamespaces(report.namespaces, state)), [report.namespaces, state]);
  const totalMetric = totals[state.metric];
  const meta = METRIC_META[state.metric];

  const selectedGroup = all.find((g) => g.name === state.selected);

  return (
    <section id="top-contributors" style={{ marginTop: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(600px, 1fr) 400px", gap: 16, alignItems: "start" }}>
        <Card padding="md">
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 12 }}>
            ④ Top 贡献者
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {list.map((g, i) => {
              const v = g[state.metric];
              const cum = list.slice(0, i + 1).reduce((s, x) => s + x[state.metric], 0);
              const isSelected = g.name === state.selected;
              return (
                <div
                  key={g.name}
                  onClick={() => onSelect(g.name)}
                  style={{
                    display: "grid", gridTemplateColumns: "36px minmax(160px, 1fr) minmax(280px, 2fr) 80px 70px 64px",
                    gap: 10, alignItems: "center", minHeight: 44,
                    padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    background: isSelected ? "var(--accentBg)" : "var(--bgBase)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bgHover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bgBase)";
                  }}
                >
                  <div style={{ color: "var(--textMuted)", fontWeight: 800, textAlign: "right", fontSize: 12 }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: "var(--textMuted)" }}>{g.namespaces.length} namespaces</div>
                  </div>
                  <div style={{ position: "relative", height: 20, borderRadius: 999, background: "var(--bgOverlay)", overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", inset: "0 auto 0 0", width: `${pct(v, totalMetric).toFixed(2)}%`,
                      borderRadius: "inherit", background: `var(--${meta.cls})`, transition: "width 0.4s ease",
                    }} />
                    <div style={{
                      position: "relative", zIndex: 1, display: "flex", height: "100%", alignItems: "center",
                      justifyContent: "flex-end", paddingRight: 8, fontSize: 11, fontWeight: 800,
                      color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                    }}>{meta.fmt(v)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{meta.fmt(v)}</div>
                  <div style={{ fontSize: 12, color: "var(--textMuted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(v, totalMetric).toFixed(1)}%</div>
                  <div style={{ fontSize: 12, color: "var(--textMuted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>Σ {pct(cum, totalMetric).toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="md">
          {selectedGroup ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedGroup.name}</div>
                  <div style={{ fontSize: 12, color: "var(--textMuted)" }}>
                    {selectedGroup.namespaces.length} namespaces · {meta.fmt(selectedGroup[state.metric])} {meta.label}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--bgBase)" }}>
                  <div style={{ fontSize: 10, color: "var(--textMuted)", marginBottom: 2 }}>CPU</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatCpu(selectedGroup.cpu)}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--bgBase)" }}>
                  <div style={{ fontSize: 10, color: "var(--textMuted)", marginBottom: 2 }}>Memory</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatBytes(selectedGroup.memory)}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--bgBase)" }}>
                  <div style={{ fontSize: 10, color: "var(--textMuted)", marginBottom: 2 }}>Storage</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatBytes(selectedGroup.storage)}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(["cpu", "memory", "storage"] as const).map((k) => {
                  const max = Math.max(...all.map((g) => g[k]));
                  return (
                    <div key={k} style={{ display: "grid", gridTemplateColumns: "80px 1fr 64px", gap: 10, alignItems: "center", fontSize: 12, color: "var(--textMuted)" }}>
                      <div>{k.toUpperCase()}</div>
                      <div style={{ height: 8, borderRadius: 999, background: "var(--bgOverlay)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "inherit", background: `var(--${k})`, width: `${pct(selectedGroup[k], max).toFixed(1)}%`, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ textAlign: "right" }}>{METRIC_META[k].fmt(selectedGroup[k])}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--textMuted)" }}>
                占当前范围 {meta.label} 的 <strong style={{ color: "var(--text)" }}>{pct(selectedGroup[state.metric], totals[state.metric]).toFixed(1)}%</strong>
              </div>
            </>
          ) : (
            <div style={{ color: "var(--textMuted)", textAlign: "center", padding: "40px 20px" }}>
              点击左侧排行条目查看详情
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};
