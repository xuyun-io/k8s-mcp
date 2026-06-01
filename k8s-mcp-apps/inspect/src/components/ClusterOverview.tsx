import React, { useMemo } from "react";
import type { InspectReport, ViewerState } from "../types";
import {
  compactCpuCores, compactGi, compactStorageTi, compactMetricValue,
  overviewMetricLabel, currentNamespaces, sum, currentGroups, displayGroups, pct,
} from "../utils";
import { StatCard, MetricCard } from "../../../shared/components";
import { IconCpu, IconMemory, IconStorage, IconPods, IconPvc, IconIngress, IconCronjob, IconConfigMap, IconSecret } from "./Icons";

interface Props {
  report: InspectReport;
  state: ViewerState;
}

export const ClusterOverview: React.FC<Props> = ({ report, state }) => {
  const t = report.totals;
  const ns = currentNamespaces(report.namespaces, state);
  const totals = useMemo(() => sum(ns), [ns]);
  const allGroups = useMemo(() => currentGroups(report.namespaces, state), [report.namespaces, state]);
  const topGroups = useMemo(() => displayGroups(report.namespaces, state), [report.namespaces, state]);
  const totalMetric = totals[state.metric] || 0;
  const topTotal = topGroups.reduce((s, g) => s + g[state.metric], 0);

  const clusterName = report.cluster || "集群成本分析";
  const generatedAt = report.generatedAt || "--";
  const storage = compactStorageTi(t);

  return (
    <section id="overview" style={{ marginTop: 0 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start",
        padding: 22,
        background: "var(--glassBg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid var(--glassBorder)",
        borderTop: "1px solid var(--glassBorderHighlight)",
        boxShadow: "var(--glassShadow)",
        borderRadius: 16,
        marginBottom: 16,
      }}>
        <div>
          <div style={{ color: "var(--info)", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Cluster Cost Analysis
          </div>
          <h1 style={{ margin: "6px 0 8px", fontSize: 26, lineHeight: 1.25, fontWeight: 700 }}>{clusterName}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={pillStyle}>{(t.namespace_count || report.namespaces.length) + " NS"}</span>
            <span style={pillStyle}>{(t.pod_count || totals.pods) + " Pods"}</span>
            <span style={pillStyle}>{compactCpuCores(t) + " CPU"}</span>
            <span style={pillStyle}>{compactGi(t) + " Gi Memory"}</span>
          </div>
        </div>
        <div style={{ color: "var(--textMuted)", fontSize: 13, textAlign: "right" }}>
          生成时间：{generatedAt}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        <StatCard icon={<IconCpu />} iconColor="var(--cpu)" iconBg="var(--cpuBg)"
          label="CPU 申请" value={compactCpuCores(t)} unit="Cores" sub="集群总申请量" />
        <StatCard icon={<IconMemory />} iconColor="var(--memory)" iconBg="var(--memoryBg)"
          label="内存申请" value={compactGi(t)} unit="Gi" sub="集群总申请量" />
        <StatCard icon={<IconStorage />} iconColor="var(--storage)" iconBg="var(--storageBg)"
          label="存储申请" value={storage.value} unit={storage.unit} sub="PVC 总申请容量" />
        <StatCard icon={<IconPods />} iconColor="var(--success)" iconBg="var(--successBg)"
          label="运行 Pod" value={String(t.pod_count || 0)} sub="工作负载" />
        <StatCard icon={<IconPvc />} iconColor="var(--info)" iconBg="var(--infoBg)"
          label="PVC" value={String(t.pvc_count || 0)}
          sub={t.orphan_pvc_count > 0 ? `${t.orphan_pvc_count} 异常` : "无异常"}
          warning={t.orphan_pvc_count > 0} />
        <StatCard icon={<IconIngress />} iconColor="var(--error)" iconBg="var(--errorBg)"
          label="Ingress" value={String(t.ingress_count || 0)}
          sub={t.orphan_ingress_count > 0 ? `${t.orphan_ingress_count} 异常` : "无异常"}
          warning={t.orphan_ingress_count > 0} />
        <StatCard icon={<IconConfigMap />} iconColor="var(--info)" iconBg="var(--infoBg)"
          label="ConfigMap" value={String(t.configmap_count || 0)}
          sub={t.orphan_configmap_count > 0 ? `${t.orphan_configmap_count} 异常` : "无异常"}
          warning={t.orphan_configmap_count > 0} />
        <StatCard icon={<IconSecret />} iconColor="var(--warning)" iconBg="var(--warningBg)"
          label="Secret" value={String(t.secret_count || 0)}
          sub={t.orphan_secret_count > 0 ? `${t.orphan_secret_count} 异常` : "无异常"}
          warning={t.orphan_secret_count > 0} />
        <StatCard icon={<IconCronjob />} iconColor="var(--warning)" iconBg="var(--warningBg)"
          label="定时任务" value={`${t.active_cronjob_count || 0} / ${t.cronjob_count || 0}`}
          sub={(t.cronjob_count || 0) > 0 ? `${((t.active_cronjob_count || 0) / (t.cronjob_count || 1) * 100).toFixed(0)}% 有效` : "无定时任务"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
        <MetricCard label="当前范围" value={state.dimension === "cluster" ? "Cluster" : state.dimension === "ivs" ? "IVS" : "Product"}
          hint={`${ns.length} namespaces`} />
        <MetricCard label={overviewMetricLabel(state.metric)} value={compactMetricValue(state.metric, totalMetric)}
          hint="当前范围总量" highlight />
        <MetricCard label="Top 覆盖" value={`${pct(topTotal, totalMetric).toFixed(1)}%`}
          hint={`${topGroups.length} / ${allGroups.length} groups`} />
        <MetricCard label="工作负载" value={String(totals.pods)}
          hint={`${totals.pvcs} PVC, ${totals.ingresses} Ingress`} />
      </div>
    </section>
  );
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", minHeight: 26,
  border: "1px solid var(--borderStrong)", borderRadius: 999,
  padding: "3px 10px", color: "var(--textSecondary)",
  background: "var(--bgOverlay)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
};
