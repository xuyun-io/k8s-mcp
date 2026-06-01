import React, { useMemo } from "react";
import type { InspectReport, OrphanIngressItem, OrphanPvcItem, OrphanConfigMapItem, OrphanSecretItem } from "../types";
import { Table, Card } from "../../../shared/components";
import type { Column } from "../../../shared/components";
import { AlertTriangle } from "lucide-react";

interface Props {
  report: InspectReport;
}

interface FlatIngress extends OrphanIngressItem {
  namespace: string;
  [key: string]: unknown;
}

interface FlatPvc extends OrphanPvcItem {
  namespace: string;
  [key: string]: unknown;
}

interface FlatConfigMap extends OrphanConfigMapItem {
  namespace: string;
  [key: string]: unknown;
}

interface FlatSecret extends OrphanSecretItem {
  namespace: string;
  [key: string]: unknown;
}

export const OrphanPanel: React.FC<Props> = ({ report }) => {
  const ingresses = useMemo(() => {
    const items: FlatIngress[] = [];
    for (const ns of report.namespaces) {
      for (const ing of (ns.orphan_ingress_items || [])) {
        items.push({ ...ing, namespace: ns.name });
      }
    }
    return items;
  }, [report.namespaces]);

  const pvcs = useMemo(() => {
    const items: FlatPvc[] = [];
    for (const ns of report.namespaces) {
      for (const pvc of (ns.orphan_pvc_items || [])) {
        items.push({ ...pvc, namespace: ns.name });
      }
    }
    return items;
  }, [report.namespaces]);

  const configmaps = useMemo(() => {
    const items: FlatConfigMap[] = [];
    for (const ns of report.namespaces) {
      for (const cm of (ns.orphan_configmap_items || [])) {
        items.push({ ...cm, namespace: ns.name });
      }
    }
    return items;
  }, [report.namespaces]);

  const secrets = useMemo(() => {
    const items: FlatSecret[] = [];
    for (const ns of report.namespaces) {
      for (const sec of (ns.orphan_secret_items || [])) {
        items.push({ ...sec, namespace: ns.name });
      }
    }
    return items;
  }, [report.namespaces]);

  const ingressColumns: Column<FlatIngress>[] = [
    { key: "namespace", header: "命名空间", width: "160px" },
    { key: "name", header: "资源名称", width: "180px", render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: "hosts", header: "Host", render: (r) => <span style={{ fontSize: 12, color: "var(--textSecondary)" }}>{(r.hosts || []).join(", ") || "—"}</span> },
    { key: "reason", header: "问题", render: (r) => <span style={{ fontSize: 12, color: "var(--warning)" }}>{r.reason}</span> },
  ];

  const pvcColumns: Column<FlatPvc>[] = [
    { key: "namespace", header: "命名空间", width: "160px" },
    { key: "name", header: "资源名称", width: "180px", render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: "storage_class", header: "StorageClass", width: "130px", render: (r) => <span style={{ fontSize: 12 }}>{r.storage_class || "—"}</span> },
    { key: "capacity", header: "容量", width: "100px", render: (r) => <span style={{ fontSize: 12 }}>{r.capacity || "—"}</span> },
    { key: "reason", header: "问题", render: (r) => <span style={{ fontSize: 12, color: "var(--warning)" }}>{r.reason}</span> },
  ];

  const cmColumns: Column<FlatConfigMap>[] = [
    { key: "namespace", header: "命名空间", width: "160px" },
    { key: "name", header: "资源名称", width: "180px", render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: "reason", header: "问题", render: (r) => <span style={{ fontSize: 12, color: "var(--warning)" }}>{r.reason}</span> },
  ];

  const secretColumns: Column<FlatSecret>[] = [
    { key: "namespace", header: "命名空间", width: "160px" },
    { key: "name", header: "资源名称", width: "180px", render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: "reason", header: "问题", render: (r) => <span style={{ fontSize: 12, color: "var(--warning)" }}>{r.reason}</span> },
  ];

  const totalOrphans = ingresses.length + pvcs.length + configmaps.length + secrets.length;

  return (
    <section id="orphans" style={{ marginTop: 22 }}>
      <Card padding="md">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <AlertTriangle size={16} color="var(--warning)" />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--textSecondary)" }}>
            ⑦ 孤儿资源检测
          </div>
          <span style={{ fontSize: 12, color: "var(--textMuted)", marginLeft: "auto" }}>
            共 {totalOrphans} 项孤儿资源（产生成本风险）
          </span>
        </div>

        {ingresses.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--error)" }}>
              Ingress ({ingresses.length})
            </div>
            <Table data={ingresses} columns={ingressColumns} keyExtractor={(r) => `${r.namespace}/${r.name}`} emptyMessage="无孤儿 Ingress" />
          </div>
        )}

        {pvcs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--error)" }}>
              PVC ({pvcs.length})
            </div>
            <Table data={pvcs} columns={pvcColumns} keyExtractor={(r) => `${r.namespace}/${r.name}`} emptyMessage="无孤儿 PVC" />
          </div>
        )}

        {configmaps.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--warning)" }}>
              ConfigMap ({configmaps.length})
            </div>
            <Table data={configmaps} columns={cmColumns} keyExtractor={(r) => `${r.namespace}/${r.name}`} emptyMessage="无孤儿 ConfigMap" />
          </div>
        )}

        {secrets.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--warning)" }}>
              Secret ({secrets.length})
            </div>
            <Table data={secrets} columns={secretColumns} keyExtractor={(r) => `${r.namespace}/${r.name}`} emptyMessage="无孤儿 Secret" />
          </div>
        )}

        {totalOrphans === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--textMuted)", fontSize: 13 }}>
            未检测到孤儿资源，集群资源引用关系健康。
          </div>
        )}
      </Card>
    </section>
  );
};
