import type { Dimension, Metric, NamespaceItem, ViewerState } from "./types";

export const COLORS = [
  "#f59e0b",
  "#a78bfa",
  "#38bdf8",
  "#22c55e",
  "#fb7185",
  "#22d3ee",
];

export const METRIC_META: Record<
  Metric,
  { label: string; cls: string; fmt: (v: number) => string }
> = {
  cpu: { label: "CPU Request", cls: "cpu", fmt: formatCpu },
  memory: { label: "Memory Request", cls: "memory", fmt: formatBytes },
  storage: { label: "Storage Request", cls: "storage", fmt: formatBytes },
};

export const TABLE_COLUMNS: Record<
  string,
  { label: string; type: "string" | "number" | "bytes" | "cpu" | "cronjob" }
> = {
  name: { label: "Namespace", type: "string" },
  ivs: { label: "IVS", type: "string" },
  product: { label: "Product", type: "string" },
  status: { label: "Status", type: "string" },
  cpu: { label: "CPU", type: "cpu" },
  memory: { label: "Memory", type: "bytes" },
  storage: { label: "Storage", type: "bytes" },
  pods: { label: "Pods", type: "number" },
  pvcs: { label: "PVCs", type: "number" },
  orphan_pvcs: { label: "Orphan PVCs", type: "number" },
  ingresses: { label: "Ingresses", type: "number" },
  orphanIngresses: { label: "Orphan Ing", type: "number" },
  configmaps: { label: "ConfigMaps", type: "number" },
  orphan_configmaps: { label: "Orphan CM", type: "number" },
  secrets: { label: "Secrets", type: "number" },
  orphan_secrets: { label: "Orphan Sec", type: "number" },
  cronjobs: { label: "CronJobs", type: "cronjob" },
};

export function formatCpu(mc: number): string {
  if (!mc) return "0";
  if (mc >= 1000) return (mc / 1000).toFixed(2).replace(/\.00$/, "") + " core";
  return Math.round(mc) + "m";
}

export function formatBytes(b: number): string {
  if (!b) return "0";
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " Gi";
  if (b >= 1048576) return (b / 1048576).toFixed(1) + " Mi";
  if (b >= 1024) return (b / 1024).toFixed(1) + " Ki";
  return b + " B";
}

export function pct(v: number, t: number): number {
  return t > 0 ? (v / t) * 100 : 0;
}

export function compactFixed(value: number, digits: number): string {
  return Number(value || 0)
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function compactCpuCores(t: {
  cpu_cores?: number;
  cpu_millicores?: number;
}): string {
  let cores = Number(t.cpu_cores || 0);
  if (!cores && t.cpu_millicores) cores = t.cpu_millicores / 1000;
  return compactFixed(cores, cores >= 10 ? 1 : 2);
}

export function compactGi(t: {
  memory_gib?: number;
  memory_bytes?: number;
}): string {
  let gib = Number(t.memory_gib || 0);
  if (!gib && t.memory_bytes) gib = t.memory_bytes / 1073741824;
  return compactFixed(gib, gib >= 10 ? 0 : 1);
}

export function compactStorageTi(t: {
  storage_gib?: number;
  storage_bytes?: number;
}): { value: string; unit: string } {
  let gib = Number(t.storage_gib || 0);
  if (!gib && t.storage_bytes) gib = t.storage_bytes / 1073741824;
  if (gib >= 1024)
    return { value: compactFixed(gib / 1024, 1), unit: "Ti" };
  return { value: compactFixed(gib, gib >= 10 ? 0 : 1), unit: "Gi" };
}

export function compactMetricValue(metric: Metric, value: number): string {
  if (metric === "cpu") return compactFixed((value || 0) / 1000, 1) + " CPU";
  if (metric === "memory")
    return compactFixed((value || 0) / 1073741824, 0) + " Gi";
  if (metric === "storage") {
    const gib = (value || 0) / 1073741824;
    return gib >= 1024
      ? compactFixed(gib / 1024, 1) + " Ti"
      : compactFixed(gib, 0) + " Gi";
  }
  return String(value || 0);
}

export function overviewMetricLabel(metric: Metric): string {
  return METRIC_META[metric].label;
}

export function dimLabel(dimension: Dimension): string {
  if (dimension === "cluster") return "Namespace";
  if (dimension === "ivs") return "IVS";
  return "Product";
}

export function groupName(ns: NamespaceItem, dimension: Dimension): string {
  if (dimension === "cluster") return ns.name;
  if (dimension === "ivs") return ns.ivs || "(未标注)";
  return ns.product || "(未标注)";
}

export function missingFor(
  ns: NamespaceItem,
  dim: Dimension
): boolean {
  if (dim === "cluster") return false;
  if (dim === "ivs") return !ns.ivs;
  return !ns.product;
}

export function currentNamespaces(
  namespaces: NamespaceItem[],
  state: ViewerState
): NamespaceItem[] {
  let rows = namespaces.slice();
  if (state.dimension !== "cluster") {
    rows = rows.filter((ns) => {
      const m = missingFor(ns, state.dimension);
      if (state.untagged === "exclude") return !m;
      if (state.untagged === "only") return m;
      return true;
    });
  }
  return rows;
}

export function sum(rows: NamespaceItem[]) {
  return rows.reduce(
    (a, ns) => {
      a.cpu += ns.cpu || 0;
      a.memory += ns.memory || 0;
      a.storage += ns.storage || 0;
      a.pods += ns.pods || 0;
      a.pvcs += ns.pvcs || 0;
      a.ingresses += ns.ingresses || 0;
      a.orphanIngresses += ns.orphanIngresses || 0;
      a.configmaps += ns.configmaps || 0;
      a.orphan_configmaps += ns.orphan_configmaps || 0;
      a.secrets += ns.secrets || 0;
      a.orphan_secrets += ns.orphan_secrets || 0;
      return a;
    },
    {
      cpu: 0,
      memory: 0,
      storage: 0,
      pods: 0,
      pvcs: 0,
      ingresses: 0,
      orphanIngresses: 0,
      configmaps: 0,
      orphan_configmaps: 0,
      secrets: 0,
      orphan_secrets: 0,
    }
  );
}

export interface GroupedItem {
  name: string;
  namespaces: NamespaceItem[];
  cpu: number;
  memory: number;
  storage: number;
  pods: number;
  pvcs: number;
  ingresses: number;
  orphanIngresses: number;
  configmaps: number;
  orphan_configmaps: number;
  secrets: number;
  orphan_secrets: number;
}

export function currentGroups(
  namespaces: NamespaceItem[],
  state: ViewerState
): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  currentNamespaces(namespaces, state).forEach((ns) => {
    const name = groupName(ns, state.dimension);
    if (!map.has(name)) {
      map.set(name, {
        name,
        namespaces: [],
        cpu: 0,
        memory: 0,
        storage: 0,
        pods: 0,
        pvcs: 0,
        ingresses: 0,
        orphanIngresses: 0,
        configmaps: 0,
        orphan_configmaps: 0,
        secrets: 0,
        orphan_secrets: 0,
      });
    }
    const g = map.get(name)!;
    g.namespaces.push(ns);
    g.cpu += ns.cpu || 0;
    g.memory += ns.memory || 0;
    g.storage += ns.storage || 0;
    g.pods += ns.pods || 0;
    g.pvcs += ns.pvcs || 0;
    g.ingresses += ns.ingresses || 0;
    g.orphanIngresses += ns.orphanIngresses || 0;
  });
  const arr = Array.from(map.values());
  arr.sort((a, b) => b[state.metric] - a[state.metric]);
  return arr;
}

export function displayGroups(
  namespaces: NamespaceItem[],
  state: ViewerState
): GroupedItem[] {
  const all = currentGroups(namespaces, state);
  const n = state.topn;
  return n >= 999 ? all : all.slice(0, n);
}

export function selectDefault(
  namespaces: NamespaceItem[],
  state: ViewerState
): string {
  const list = displayGroups(namespaces, state);
  if (!list.length) return "";
  if (!list.some((g) => g.name === state.selected)) {
    return list[0].name;
  }
  return state.selected;
}


