import { ReportAgent } from "./agents.js";
import type { DocsContext, ReviewResult } from "./types.js";

export function renderMarkdownReport(context: DocsContext, review: ReviewResult): string {
  return new ReportAgent().createReport(context, review);
}

