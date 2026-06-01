import { useEffect, useMemo, useState, useCallback } from "react";
import type { InspectReport, ViewerState, Dimension, Metric, UntaggedMode, NamespaceDetailData, NamespaceItem } from "./types";
import { connectInspectApp, type InspectAppClient } from "./mcpClient";
import { selectDefault } from "./utils";
import { getTheme, setTheme } from "../../shared/theme";
import { Sidebar, Button, Select } from "../../shared/components";
import { ClusterOverview } from "./components/ClusterOverview";
import { CoveragePanel } from "./components/CoveragePanel";
import { DistributionPies } from "./components/DistributionPies";
import { TopContributors } from "./components/TopContributors";
import { CronjobPanel } from "./components/CronjobPanel";
import { NamespaceTable } from "./components/NamespaceTable";
import { OrphanPanel } from "./components/OrphanPanel";
import { NamespaceDetail } from "./components/NamespaceDetail";

const centerStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" };
const errorStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", padding: 24 };

type Status = "connecting" | "loading" | "ready" | "error";

const NAV_ITEMS = [
  { id: "overview", label: "① 集群总览", sub: "核心指标与控制面板" },
  { id: "coverage", label: "② 标注进度", sub: "IVS / Product 覆盖率" },
  { id: "distribution", label: "③ 分布概览", sub: "CPU / Memory / Storage 饼图" },
  { id: "top-contributors", label: "④ Top 贡献者", sub: "排行与下钻详情" },
  { id: "cronjobs", label: "⑤ 定时任务", sub: "CronJob 状态与分布" },
  { id: "full-list", label: "⑥ 完整列表", sub: "全部 namespace 明细" },
  { id: "orphans", label: "⑦ 孤儿检测", sub: "未引用资源与成本风险" },
];

const DEFAULT_STATE: ViewerState = {
  dimension: "cluster",
  metric: "cpu",
  topn: 10,
  untagged: "include",
  selected: "",
};

export function App() {
  const [client, setClient] = useState<InspectAppClient | null>(null);
  const [report, setReport] = useState<InspectReport | null>(null);
  const [reportId, setReportId] = useState<string>("latest");
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ViewerState>(DEFAULT_STATE);
  const [activeNav, setActiveNav] = useState<string>("overview");
  const [theme, setThemeState] = useState(getTheme);
  const [detailNs, setDetailNs] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<NamespaceDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    connectInspectApp({
      onReportId(id) {
        if (!mounted) return;
        setReportId(id);
      },
      onHostContextChanged() {},
    })
      .then((c) => {
        if (!mounted) return;
        setClient(c);
        setStatus("loading");
      })
      .catch((cause) => {
        if (!mounted) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Failed to connect to MCP host.");
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!client || !reportId) return;
    let mounted = true;
    setStatus("loading");
    setError(null);
    client
      .loadReportData(reportId)
      .then((result) => {
        if (!mounted) return;
        let data: InspectReport | null = null;
        if (result.structuredContent && typeof result.structuredContent === "object") {
          data = result.structuredContent as unknown as InspectReport;
        } else {
          const text = result.content
            ?.filter((item) => item.type === "text")
            .map((item) => (item as { text: string }).text)
            .find(Boolean);
          if (text) {
            try { data = JSON.parse(text) as InspectReport; } catch { /* ignore */ }
          }
        }
        if (data) {
          setReport(data);
          setState((prev) => ({ ...prev, selected: selectDefault(data.namespaces, prev) }));
          setStatus("ready");
        } else {
          setStatus("error");
          setError("Report data format invalid.");
        }
      })
      .catch((cause) => {
        if (!mounted) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Failed to load report data.");
      });
    return () => { mounted = false; };
  }, [client, reportId]);

  const handleNav = useCallback((id: string) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSelect = useCallback((name: string) => {
    setState((prev) => ({ ...prev, selected: name }));
  }, []);

  const openNamespaceDetail = useCallback(async (ns: NamespaceItem | string) => {
    const name = typeof ns === "string" ? ns : ns.name;
    if (!client) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    setDetailNs(name);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const result = await client.loadNamespaceDetail(name);
      let data: NamespaceDetailData | null = null;
      if (result.structuredContent && typeof result.structuredContent === "object") {
        data = result.structuredContent as unknown as NamespaceDetailData;
      } else {
        const text = result.content
          ?.filter((item) => item.type === "text")
          .map((item) => (item as { text: string }).text)
          .find(Boolean);
        if (text) {
          try { data = JSON.parse(text) as NamespaceDetailData; } catch { /* ignore */ }
        }
      }
      if (data && data.success) {
        setDetailData(data);
      } else {
        setDetailNs(null);
        setError(data?.error || "Failed to load namespace detail.");
      }
    } catch (cause) {
      setDetailNs(null);
      setError(cause instanceof Error ? cause.message : "Failed to load namespace detail.");
    } finally {
      setDetailLoading(false);
    }
  }, [client]);

  const closeNamespaceDetail = useCallback(() => {
    setDetailNs(null);
    setDetailData(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const updateState = useCallback(<K extends keyof ViewerState>(key: K, value: ViewerState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  const hintText = useMemo(() => {
    return state.dimension === "cluster"
      ? "Cluster 维度按 namespace 从大到小排序。"
      : "点击排行条目可下钻到该 IVS/Product 的 namespace 明细。";
  }, [state.dimension]);

  if (detailNs && detailData) {
    return (
      <div className="app" style={{ display: "flex", maxWidth: 1920, margin: "0 auto" }}>
        <Sidebar title="导航" items={NAV_ITEMS} activeId={activeNav} onNavigate={handleNav} />
        <main style={{ flex: 1, minWidth: 0, padding: "28px 24px 48px" }}>
          <NamespaceDetail
            data={detailData}
            cluster={report?.cluster || ""}
            onBack={closeNamespaceDetail}
          />
        </main>
      </div>
    );
  }

  if (detailLoading) {
    return (
      <main style={{ color: "var(--textMuted)", padding: "40px 24px", minHeight: 120 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, marginBottom: 6, fontWeight: 600 }}>Loading namespace detail...</div>
          <div style={{ fontSize: 13 }}>{detailNs}</div>
        </div>
      </main>
    );
  }

  if (status === "connecting" || status === "loading") {
    return (
      <main style={{ ...centerStyle, color: "var(--textMuted)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 8, fontWeight: 600 }}>
            {status === "connecting" ? "Connecting to MCP host..." : "Loading report data..."}
          </div>
          <div style={{ fontSize: 13 }}>reportId: {reportId}</div>
        </div>
      </main>
    );
  }

  if (status === "error" || !report) {
    return (
      <main style={{ ...errorStyle, color: "var(--error)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 8, fontWeight: 700 }}>Error</div>
          <div style={{ fontSize: 13, color: "var(--textMuted)" }}>{error || "No report data available."}</div>
        </div>
      </main>
    );
  }

  return (
    <div className="app" style={{ display: "flex", maxWidth: 1920, margin: "0 auto" }}>
      <Sidebar title="导航" items={NAV_ITEMS} activeId={activeNav} onNavigate={handleNav} />

      <main style={{ flex: 1, minWidth: 0, padding: "28px 24px 48px" }}>
        {/* Controls toolbar */}
        <div style={{
          display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap",
          marginBottom: 20, padding: 14,
          background: "var(--glassBg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid var(--glassBorder)",
          borderTop: "1px solid var(--glassBorderHighlight)",
          boxShadow: "var(--glassShadow)",
          borderRadius: 16,
        }}>
          <Select label="分析维度" value={state.dimension}
            onChange={(e) => updateState("dimension", e.target.value as Dimension)}>
            <option value="cluster">Cluster (Namespace)</option>
            <option value="ivs">IVS</option>
            <option value="product">Product</option>
          </Select>
          <Select label="排序指标" value={state.metric}
            onChange={(e) => updateState("metric", e.target.value as Metric)}>
            <option value="cpu">CPU Request</option>
            <option value="memory">Memory Request</option>
            <option value="storage">Storage Request</option>
          </Select>
          <Select label="Top N" value={String(state.topn)}
            onChange={(e) => updateState("topn", Number(e.target.value))}>
            <option value="10">Top 10</option>
            <option value="20">Top 20</option>
            <option value="50">Top 50</option>
            <option value="999">全部</option>
          </Select>
          <Select label="未标注处理" value={state.untagged}
            onChange={(e) => updateState("untagged", e.target.value as UntaggedMode)}>
            <option value="include">包含</option>
            <option value="exclude">排除</option>
            <option value="only">仅未标注</option>
          </Select>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button size="sm" onClick={() => setState(DEFAULT_STATE)}>重置</Button>
            <Button size="sm" variant="ghost" onClick={toggleTheme}>
              {theme === "dark" ? "☀️" : "🌙"}
            </Button>
          </div>
          <div style={{ flex: 1, textAlign: "right", fontSize: 12, color: "var(--textMuted)", alignSelf: "center" }}>
            {hintText}
          </div>
        </div>

        <ClusterOverview report={report} state={state} />
        <CoveragePanel report={report} state={state} />
        <DistributionPies report={report} state={state} />
        <TopContributors report={report} state={state} onSelect={handleSelect} />
        <CronjobPanel report={report} />
        <NamespaceTable report={report} state={state} onRowClick={openNamespaceDetail} />
        <OrphanPanel report={report} />
      </main>
    </div>
  );
}
