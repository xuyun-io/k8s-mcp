import React, { useMemo, useState, useEffect } from "react";
import type { NamespaceDetailData } from "../types";
import { Table, Card } from "../../../shared/components";
import type { Column } from "../../../shared/components";
import {
  ArrowLeft,
  Boxes,
  Server,
  Network,
  HardDrive,
  Bell,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  CircleDashed,
} from "lucide-react";

interface Props {
  data: NamespaceDetailData;
  cluster: string;
  onBack: () => void;
}

const glassCard: React.CSSProperties = {
  background: "var(--glassBg)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid var(--glassBorder)",
  borderTop: "1px solid var(--glassBorderHighlight)",
  boxShadow: "var(--glassShadow)",
  borderRadius: 16,
};

function phaseColor(phase: string): string {
  const p = phase.toLowerCase();
  if (p === "running") return "var(--success)";
  if (p === "pending") return "var(--warning)";
  if (p === "failed") return "var(--error)";
  if (p === "succeeded") return "var(--info)";
  return "var(--textMuted)";
}

function phaseBg(phase: string): string {
  const p = phase.toLowerCase();
  if (p === "running") return "rgba(74,222,128,0.12)";
  if (p === "pending") return "rgba(251,191,36,0.12)";
  if (p === "failed") return "rgba(251,113,133,0.12)";
  if (p === "succeeded") return "rgba(56,189,248,0.12)";
  return "rgba(100,116,139,0.12)";
}

function eventSeverity(type: string): { color: string; bg: string } {
  const t = type.toLowerCase();
  if (t === "warning") return { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  if (t === "normal") return { color: "var(--success)", bg: "rgba(74,222,128,0.12)" };
  return { color: "var(--info)", bg: "rgba(56,189,248,0.12)" };
}

function healthScore(data: NamespaceDetailData): { score: number; label: string; color: string } {
  const pods = data.pods || [];
  const events = data.events || [];
  if (pods.length === 0) return { score: 0, label: "无 Pod", color: "var(--textMuted)" };
  const failed = pods.filter((p) => p.phase.toLowerCase() === "failed").length;
  const pending = pods.filter((p) => p.phase.toLowerCase() === "pending").length;
  const warnings = events.filter((e) => (e.type || "").toLowerCase() === "warning").length;
  let score = 100;
  score -= failed * 15;
  score -= pending * 5;
  score -= warnings * 3;
  score = Math.max(0, Math.min(100, score));
  if (score >= 90) return { score, label: "健康", color: "var(--success)" };
  if (score >= 70) return { score, label: "警告", color: "var(--warning)" };
  return { score, label: "危险", color: "var(--error)" };
}

export const NamespaceDetail: React.FC<Props> = ({ data, cluster, onBack }) => {
  const [activeTab, setActiveTab] = useState<"pods" | "events" | "resources">("pods");

  useEffect(() => {
    const scrollTop = () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (window.parent !== window) {
        try { window.parent.scrollTo({ top: 0, behavior: "instant" }); } catch { /* ignore cross-origin */ }
      }
    };
    scrollTop();
    const t1 = setTimeout(scrollTop, 50);
    const t2 = setTimeout(scrollTop, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const scoreInfo = useMemo(() => healthScore(data), [data]);

  const podPhases = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of data.pods || []) {
      map.set(p.phase, (map.get(p.phase) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [data.pods]);

  const warningEvents = useMemo(
    () => (data.events || []).filter((e) => (e.type || "").toLowerCase() === "warning"),
    [data.events]
  );

  const metricItems = [
    {
      icon: <Boxes size={20} />,
      label: "Pods",
      value: data.pods?.length || 0,
      color: "var(--success)",
      bg: "rgba(74,222,128,0.12)",
    },
    {
      icon: <Activity size={20} />,
      label: "Deployments",
      value: data.deployments?.length || 0,
      color: "var(--info)",
      bg: "rgba(56,189,248,0.12)",
    },
    {
      icon: <Network size={20} />,
      label: "Services",
      value: data.services?.length || 0,
      color: "var(--accent)",
      bg: "rgba(96,165,250,0.12)",
    },
    {
      icon: <Server size={20} />,
      label: "Ingresses",
      value: data.ingresses?.length || 0,
      color: "#fb7185",
      bg: "rgba(251,113,133,0.12)",
    },
    {
      icon: <HardDrive size={20} />,
      label: "PVCs",
      value: data.pvcs?.length || 0,
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.12)",
    },
    {
      icon: <Bell size={20} />,
      label: "Events",
      value: data.events?.length || 0,
      sub: warningEvents.length > 0 ? `${warningEvents.length} 警告` : undefined,
      color: warningEvents.length > 0 ? "var(--warning)" : "var(--textMuted)",
      bg: warningEvents.length > 0 ? "rgba(251,191,36,0.12)" : "rgba(100,116,139,0.12)",
    },
  ];

  const podColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", width: "180px", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
    {
      key: "phase",
      header: "Status",
      width: "100px",
      render: (r) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: phaseColor(r.phase),
            background: phaseBg(r.phase),
            border: `1px solid ${phaseColor(r.phase)}33`,
          }}
        >
          {r.phase.toLowerCase() === "running" && <CheckCircle2 size={10} />}
          {r.phase.toLowerCase() === "pending" && <Clock size={10} />}
          {r.phase.toLowerCase() === "failed" && <XCircle size={10} />}
          {r.phase.toLowerCase() === "succeeded" && <CheckCircle2 size={10} />}
          {!["running", "pending", "failed", "succeeded"].includes(r.phase.toLowerCase()) && <CircleDashed size={10} />}
          {r.phase}
        </span>
      ),
    },
    { key: "ready", header: "Ready", width: "70px", align: "right" },
    { key: "restarts", header: "Restarts", width: "80px", align: "right" },
    { key: "node", header: "Node", width: "140px", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{r.node || "—"}</span> },
    { key: "ip", header: "IP", width: "110px", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{r.ip || "—"}</span> },
    { key: "age", header: "Age", width: "60px", align: "right", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.age}</span> },
  ];

  const eventColumns: Column<Record<string, any>>[] = [
    {
      key: "type",
      header: "Type",
      width: "80px",
      render: (r) => {
        const s = eventSeverity(r.type);
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: s.color,
              background: s.bg,
              border: `1px solid ${s.color}33`,
            }}
          >
            {r.type}
          </span>
        );
      },
    },
    { key: "reason", header: "Reason", width: "120px", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.reason}</span> },
    { key: "message", header: "Message", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{r.message}</span> },
    { key: "involved_object", header: "Object", width: "140px", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.involved_object}</span> },
    { key: "count", header: "Count", width: "60px", align: "right" },
    { key: "last_seen", header: "Last Seen", width: "80px", align: "right", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.last_seen}</span> },
  ];

  const deployColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
    { key: "replicas", header: "Replicas", width: "100px", align: "right", render: (r) => {
      const [ready, desired] = String(r.replicas).split("/");
      const isHealthy = ready === desired && desired !== "0";
      return (
        <span style={{ fontSize: 12, color: isHealthy ? "var(--success)" : "var(--warning)", fontWeight: 700 }}>
          {r.replicas}
        </span>
      );
    }},
    { key: "age", header: "Age", width: "80px", align: "right", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.age}</span> },
  ];

  const svcColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
    { key: "type", header: "Type", width: "100px", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{r.type}</span> },
    { key: "cluster_ip", header: "ClusterIP", width: "120px", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.cluster_ip}</span> },
    { key: "ports", header: "Ports", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{(r.ports || []).join(", ")}</span> },
  ];

  const ingColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
    { key: "hosts", header: "Hosts", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{(r.hosts || []).join(", ") || "—"}</span> },
    { key: "age", header: "Age", width: "80px", align: "right", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.age}</span> },
  ];

  const pvcColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
    { key: "status", header: "Status", width: "90px", render: (r) => (
      <span style={{ fontSize: 12, color: r.status === "Bound" ? "var(--success)" : "var(--warning)", fontWeight: 700 }}>{r.status}</span>
    )},
    { key: "capacity", header: "Capacity", width: "90px", align: "right", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{r.capacity || "—"}</span> },
    { key: "storage_class", header: "StorageClass", width: "130px", render: (r) => <span style={{ fontSize: 12, color: "var(--textMuted)" }}>{r.storage_class || "—"}</span> },
  ];

  const cmColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
  ];

  const secretColumns: Column<Record<string, any>>[] = [
    { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
    { key: "type", header: "Type", width: "180px", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{r.type}</span> },
  ];

  const tabs = [
    { id: "pods" as const, label: `Pods (${data.pods?.length || 0})` },
    { id: "events" as const, label: `Events (${data.events?.length || 0})` },
    { id: "resources" as const, label: "Other Resources" },
  ];

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Header */}
      <div style={{ ...glassCard, padding: 22, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid var(--glassBorder)",
            background: "var(--glassBg)",
            color: "var(--textSecondary)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--info)" }}>
            Namespace Detail
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 24, lineHeight: 1.2 }}>{data.namespace}</h1>
          <div style={{ fontSize: 12, color: "var(--textMuted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>Cluster: {cluster}</span>
            <span>Pods: {data.pods?.length || 0}</span>
            <span>Events: {data.events?.length || 0}</span>
          </div>
        </div>
        <div
          style={{
            minWidth: 110,
            textAlign: "center",
            padding: "14px 18px",
            borderRadius: 14,
            border: `1px solid ${scoreInfo.color}40`,
            background: `${scoreInfo.color}14`,
          }}
        >
          <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, color: scoreInfo.color }}>{scoreInfo.score}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: scoreInfo.color, marginTop: 4 }}>{scoreInfo.label}</div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        {metricItems.map((m) => (
          <div
            key={m.label}
            style={{
              ...glassCard,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 90,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: m.bg,
                color: m.color,
              }}
            >
              {m.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--textMuted)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: "var(--text)" }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 11, color: m.color, fontWeight: 700, marginTop: 2 }}>{m.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Pod Phase Distribution */}
      {podPhases.length > 0 && (
        <div style={{ ...glassCard, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>Pod Status Distribution</div>
          <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", background: "rgba(148,163,184,0.1)" }}>
            {podPhases.map(([phase, count]) => {
              const total = data.pods!.length;
              const pct = (count / total) * 100;
              return (
                <div
                  key={phase}
                  style={{
                    width: `${pct}%`,
                    background: phaseBg(phase),
                    borderRight: "1px solid var(--glassBorder)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: phaseColor(phase),
                    whiteSpace: "nowrap",
                  }}
                  title={`${phase}: ${count}`}
                >
                  {pct > 12 ? `${count} ${phase}` : ""}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            {podPhases.map(([phase, count]) => (
              <span key={phase} style={{ fontSize: 12, color: "var(--textSecondary)", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: phaseColor(phase), display: "inline-block" }} />
                {phase}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: activeTab === t.id ? "1px solid var(--accent)" : "1px solid transparent",
              background: activeTab === t.id ? "var(--accentBg)" : "transparent",
              color: activeTab === t.id ? "var(--accent)" : "var(--textSecondary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "pods" && (
        <Card padding="md">
          <Table
            data={data.pods as Array<Record<string, unknown>>}
            columns={podColumns}
            keyExtractor={(r: Record<string, any>) => String(r.name)}
            emptyMessage="No pods found"
          />
        </Card>
      )}

      {activeTab === "events" && (
        <Card padding="md">
          {warningEvents.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(251,191,36,0.3)",
                background: "rgba(251,191,36,0.08)",
                color: "var(--warning)",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={14} />
              {warningEvents.length} Warning event{warningEvents.length > 1 ? "s" : ""} detected
            </div>
          )}
          <Table
            data={data.events as Array<Record<string, unknown>>}
            columns={eventColumns}
            keyExtractor={(_r: Record<string, any>) => String(_r.message || Math.random())}
            emptyMessage="No events found"
          />
        </Card>
      )}

      {activeTab === "resources" && (
        <div style={{ display: "grid", gap: 14 }}>
          {data.deployments && data.deployments.length > 0 && (
            <Card padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>Deployments</div>
              <Table data={data.deployments as Array<Record<string, unknown>>} columns={deployColumns} keyExtractor={(r: Record<string, any>) => String(r.name)} emptyMessage="No deployments" />
            </Card>
          )}
          {data.services && data.services.length > 0 && (
            <Card padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>Services</div>
              <Table data={data.services as Array<Record<string, unknown>>} columns={svcColumns} keyExtractor={(r: Record<string, any>) => String(r.name)} emptyMessage="No services" />
            </Card>
          )}
          {data.ingresses && data.ingresses.length > 0 && (
            <Card padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>Ingresses</div>
              <Table data={data.ingresses as Array<Record<string, unknown>>} columns={ingColumns} keyExtractor={(r: Record<string, any>) => String(r.name)} emptyMessage="No ingresses" />
            </Card>
          )}
          {data.pvcs && data.pvcs.length > 0 && (
            <Card padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>PersistentVolumeClaims</div>
              <Table data={data.pvcs as Array<Record<string, unknown>>} columns={pvcColumns} keyExtractor={(r: Record<string, any>) => String(r.name)} emptyMessage="No PVCs" />
            </Card>
          )}
          {data.configmaps && data.configmaps.length > 0 && (
            <Card padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>ConfigMaps</div>
              <Table data={data.configmaps as Array<Record<string, unknown>>} columns={cmColumns} keyExtractor={(r: Record<string, any>) => String(r.name)} emptyMessage="No configmaps" />
            </Card>
          )}
          {data.secrets && data.secrets.length > 0 && (
            <Card padding="md">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textSecondary)", marginBottom: 10 }}>Secrets</div>
              <Table data={data.secrets as Array<Record<string, unknown>>} columns={secretColumns} keyExtractor={(r: Record<string, any>) => String(r.name)} emptyMessage="No secrets" />
            </Card>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
