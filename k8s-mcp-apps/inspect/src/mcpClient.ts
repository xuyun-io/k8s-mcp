import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const TOOL_NAME = "k8s_inspect_report_data";

export interface InspectAppClient {
  app: App;
  loadReportData(reportId: string): Promise<CallToolResult>;
  loadNamespaceDetail(namespace: string): Promise<CallToolResult>;
}

export async function connectInspectApp(options: {
  onReportId(reportId: string): void;
  onHostContextChanged(context: McpUiHostContext): void;
}): Promise<InspectAppClient> {
  const app = new App(
    { name: "k8s-inspect-viewer", version: "1.0.0" },
    {},
    { autoResize: true }
  );

  app.ontoolinput = (params) => {
    const args = params.arguments as Record<string, unknown> | undefined;
    const reportId =
      typeof args?.report_id === "string" ? args.report_id : "latest";
    options.onReportId(reportId);
  };

  app.onhostcontextchanged = (context) => {
    if (context.theme) {
      applyDocumentTheme(context.theme);
    }
    if (context.styles?.css?.fonts) {
      applyHostFonts(context.styles.css.fonts);
    }
    options.onHostContextChanged(context);
  };

  await app.connect(new PostMessageTransport(window.parent, window.parent));

  const hostContext = app.getHostContext();
  if (hostContext) {
    if (hostContext.theme) {
      applyDocumentTheme(hostContext.theme);
    }
    if (hostContext.styles?.css?.fonts) {
      applyHostFonts(hostContext.styles.css.fonts);
    }
    options.onHostContextChanged(hostContext);
  }

  // Extract initial reportId from tool input if already received
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialArgs = (app as any).getToolInput?.();
  if (initialArgs) {
    const args = initialArgs.arguments as Record<string, unknown> | undefined;
    const reportId =
      typeof args?.report_id === "string" ? args.report_id : "latest";
    options.onReportId(reportId);
  }

  return {
    app,
    loadReportData(reportId: string) {
      return app.callServerTool({
        name: TOOL_NAME,
        arguments: { report_id: reportId },
      });
    },
    loadNamespaceDetail(namespace: string) {
      return app.callServerTool({
        name: "k8s_inspect_namespace_detail",
        arguments: { namespace },
      });
    },
  };
}
