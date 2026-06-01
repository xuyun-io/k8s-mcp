export interface OrphanPvcItem {
  name: string;
  storage_class: string;
  capacity: string;
  reason: string;
}

export interface OrphanIngressItem {
  name: string;
  hosts: string[];
  reason: string;
}

export interface OrphanConfigMapItem {
  name: string;
  reason: string;
}

export interface OrphanSecretItem {
  name: string;
  reason: string;
}

export interface NamespaceItem {
  name: string;
  labels: Record<string, string>;
  ivs: string;
  product: string;
  status: string;
  since: string;
  duration: string;
  last_transition: string;
  last_check: string;
  last_pod_count: string;
  cpu: number;
  memory: number;
  storage: number;
  pods: number;
  pvcs: number;
  orphan_pvcs: number;
  orphan_pvc_items?: OrphanPvcItem[];
  ingresses: number;
  orphanIngresses: number;
  orphan_ingress_items?: OrphanIngressItem[];
  configmaps: number;
  orphan_configmaps: number;
  orphan_configmap_items?: OrphanConfigMapItem[];
  secrets: number;
  orphan_secrets: number;
  orphan_secret_items?: OrphanSecretItem[];
  cronjobs: CronjobItem[];
  [key: string]: unknown;
}

export interface CronjobItem {
  name: string;
  schedule: string;
  suspend: boolean;
}

export interface ClusterTotals {
  cpu_millicores: number;
  cpu_cores: number;
  cpu_formatted: string;
  memory_bytes: number;
  memory_gib: number;
  memory_formatted: string;
  storage_bytes: number;
  storage_gib: number;
  storage_formatted: string;
  pod_count: number;
  pvc_count: number;
  orphan_pvc_count: number;
  ingress_count: number;
  orphan_ingress_count: number;
  configmap_count: number;
  orphan_configmap_count: number;
  secret_count: number;
  orphan_secret_count: number;
  cronjob_count: number;
  active_cronjob_count: number;
  namespace_count: number;
  node_count: number;
  [key: string]: unknown;
}

export interface InspectReport {
  cluster: string;
  generatedAt: string;
  totals: ClusterTotals;
  namespaces: NamespaceItem[];
}

export type Dimension = "cluster" | "ivs" | "product";
export type Metric = "cpu" | "memory" | "storage";
export type UntaggedMode = "include" | "exclude" | "only";

export interface ViewerState {
  dimension: Dimension;
  metric: Metric;
  topn: number;
  untagged: UntaggedMode;
  selected: string;
}

export interface TableSort {
  column: string;
  asc: boolean;
}

export interface NamespaceDetailData {
  success: boolean;
  namespace: string;
  pods: Array<{
    name: string;
    phase: string;
    ready: string;
    restarts: number;
    node: string;
    ip: string | null;
    age: string;
  }>;
  services: Array<{
    name: string;
    type: string;
    cluster_ip: string;
    ports: string[];
  }>;
  deployments: Array<{
    name: string;
    replicas: string;
    age: string;
  }>;
  ingresses: Array<{
    name: string;
    hosts: string[];
    age: string;
  }>;
  pvcs: Array<{
    name: string;
    status: string;
    capacity: string;
    storage_class: string;
  }>;
  configmaps: Array<{ name: string }>;
  secrets: Array<{ name: string; type: string }>;
  events: Array<{
    type: string;
    reason: string;
    message: string;
    involved_object: string;
    count: number;
    last_seen: string;
  }>;
  error?: string;
}

export interface ReportSummary {
  reportId: string;
  cluster: string;
  generatedAt: string;
  namespaceCount: number;
  podCount: number;
}
