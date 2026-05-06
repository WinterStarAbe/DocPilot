import { promises as fs } from "node:fs";
import path from "node:path";
import type { AiProvider } from "./providers.js";
import type { DocsContext, DocumentIssue, DocumentSummary, Finding, ReviewResult } from "./types.js";

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".pytest_cache",
  "reports"
]);

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);
const DOCS_DIR_PATTERN = /^(docs|documentation|guides|handbook|wiki)$/i;
const LOCAL_LINK_PATTERN = /\[[^\]]+\]\(([^)]+)\)/g;

const COMMON_SECTION_PATTERNS = [
  { key: "installation", label: "installation/setup", pattern: /(install|setup|getting started|quickstart|安裝|開始|環境)/i },
  { key: "usage", label: "usage", pattern: /(usage|cli|command|example|使用|範例|指令)/i },
  { key: "development", label: "development workflow", pattern: /(development|contributing|dev|開發|貢獻)/i },
  { key: "testing", label: "testing", pattern: /(test|testing|verify|測試|驗證)/i },
  { key: "roadmap", label: "limitations/roadmap", pattern: /(roadmap|next|future|limit|known issue|後續|限制|路線)/i }
];

export class ExplorerAgent {
  async explore(targetPath: string): Promise<DocsContext> {
    const resolvedTarget = path.resolve(targetPath);
    const stats = await statRequired(resolvedTarget);

    if (!stats.isDirectory()) {
      throw new Error(`Target path is not a directory: ${resolvedTarget}`);
    }

    const allFiles = await walkFiles(resolvedTarget);
    const markdownFiles = allFiles.filter((file) => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
    const documents = await summarizeDocuments(resolvedTarget, markdownFiles);
    const topLevelDirs = await readTopLevelDirs(resolvedTarget);
    const readmePresent = documents.some((document) => /^readme(\.md|\.markdown|\.mdx)?$/i.test(path.basename(document.path)));
    const docsDirPresent = topLevelDirs.some((dir) => DOCS_DIR_PATTERN.test(dir));
    const packageSummary = await readPackageSummary(resolvedTarget);
    const missingCommonSections = findMissingCommonSections(documents);

    return {
      targetPath: resolvedTarget,
      generatedAt: new Date().toISOString(),
      project: packageSummary,
      structure: {
        topLevelDirs,
        totalFiles: allFiles.length,
        markdownFiles: markdownFiles.length,
        docsDirPresent,
        readmePresent,
        largestDocuments: documents.slice().sort((a, b) => b.words - a.words).slice(0, 5),
        riskyAreas: buildRiskyAreas(documents, readmePresent, docsDirPresent, missingCommonSections)
      },
      documents,
      coverageSignals: buildCoverageSignals(documents, readmePresent, docsDirPresent, missingCommonSections),
      qualitySignals: buildQualitySignals(documents),
      missingCommonSections
    };
  }
}

export class ReviewerAgent {
  constructor(private readonly aiProvider: AiProvider) {}

  async review(context: DocsContext): Promise<ReviewResult> {
    const ruleFindings = buildRuleFindings(context);
    const aiFindings = await this.aiProvider.analyzeDocs(context);

    return {
      ruleFindings,
      aiFindings
    };
  }
}

export class ReportAgent {
  createReport(context: DocsContext, review: ReviewResult): string {
    return [
      "# DocPilot Documentation Analysis",
      "",
      "## 核心痛點",
      "",
      "中小型專案的 README、docs 與開發說明常在快速迭代後變得分散、過期或缺少關鍵章節。DocPilot 透過多 Agent 流程把文件掃描、結構檢查與改善建議標準化，讓團隊能快速產出可提交、可審核的文件健康度報告。",
      "",
      "## 掃描摘要",
      "",
      `- Target: \`${context.targetPath}\``,
      `- Generated at: ${context.generatedAt}`,
      `- Package name: ${context.project.packageName ?? "n/a"}`,
      `- README: ${context.structure.readmePresent ? "present" : "missing"}`,
      `- Docs directory: ${context.structure.docsDirPresent ? "present" : "missing"}`,
      `- Total files: ${context.structure.totalFiles}`,
      `- Markdown files: ${context.structure.markdownFiles}`,
      `- Missing common sections: ${context.missingCommonSections.length > 0 ? context.missingCommonSections.join(", ") : "none"}`,
      "",
      "## Agent 流程",
      "",
      "1. ExplorerAgent: 掃描 Markdown 文件、README、docs 目錄、標題層級、相對連結與文件分布。",
      "2. ReviewerAgent: 結合規則式檢查與 AI provider findings，判斷文件缺口與維護風險。",
      "3. ReportAgent: 將掃描結果、風險與建議整理成可提交的 Markdown 報告。",
      "",
      "## 文件結構概覽",
      "",
      `- Top-level directories: ${context.structure.topLevelDirs.length > 0 ? context.structure.topLevelDirs.map((dir) => `\`${dir}\``).join(", ") : "none"}`,
      `- Coverage signals: ${context.coverageSignals.length > 0 ? context.coverageSignals.join("; ") : "none"}`,
      `- Quality signals: ${context.qualitySignals.length > 0 ? context.qualitySignals.join("; ") : "none"}`,
      `- Risky areas: ${context.structure.riskyAreas.length > 0 ? context.structure.riskyAreas.join("; ") : "none"}`,
      "",
      "### Largest documents",
      "",
      ...renderDocuments(context.structure.largestDocuments),
      "",
      "## 發現項目",
      "",
      ...renderFindings([...review.ruleFindings, ...review.aiFindings]),
      "",
      "## 建議下一步",
      "",
      "- 使用 `--provider gemini` 與 `GEMINI_API_KEY` 產生真實模型 findings，將 mock findings 替換為 Gemini 推理結果。",
      "- 保留 MimoProvider placeholder，等指定模型 API key 可用後再接入同一個 provider 介面。",
      "- 增加章節模板產生器，針對缺少的安裝、使用、測試與後續路線章節產生初稿。",
      "- 將文件健康度報告接到 CI artifact 或 release checklist，形成文件維護閉環。",
      "",
      "## 申請表成果描述草稿",
      "",
      "我構建了一個名為 DocPilot 的 AI 多 Agent 文件健康度分析 CLI，用於解決專案文件分散、README 缺漏、章節不完整、相對連結失效與文件維護成本過高的問題。系統由 ExplorerAgent、ReviewerAgent 與 ReportAgent 協作，先掃描 Markdown 文件、README、docs 目錄、標題層級、相對連結與常見章節覆蓋，再結合規則式檢查與可插拔 AI provider 產生風險 findings，最後輸出 Markdown 分析報告。第一版使用穩定的 MockAiProvider 驗證 Agent 流程，並已支援透過 GEMINI_API_KEY 啟用 GeminiProvider 產生真實模型 findings；MimoProvider 則保留為同一介面的後續接入點。"
    ].join("\n");
  }
}

function buildRuleFindings(context: DocsContext): Finding[] {
  const findings: Finding[] = [];
  const allIssues = context.documents.flatMap((document) => document.issues);
  const brokenLinks = allIssues.filter((issue) => issue.type === "broken-link");
  const headingSkips = allIssues.filter((issue) => issue.type === "heading-skip");
  const missingH1 = allIssues.filter((issue) => issue.type === "missing-h1");
  const emptyDocuments = allIssues.filter((issue) => issue.type === "empty");
  const shortDocuments = allIssues.filter((issue) => issue.type === "too-short");

  if (context.structure.markdownFiles === 0) {
    findings.push({
      severity: "high",
      title: "No Markdown documentation detected",
      summary: "No Markdown, MDX, or markdown files were found in the target directory.",
      recommendation: "Add a README and at least one docs page that covers setup, usage, testing, and roadmap.",
      source: "rule"
    });
  }

  if (!context.structure.readmePresent) {
    findings.push({
      severity: "high",
      title: "Missing README",
      summary: "No README document was found at the project root or scanned Markdown set.",
      recommendation: "Add README.md with project purpose, setup, usage, validation commands, and limitations.",
      source: "rule"
    });
  }

  if (!context.structure.docsDirPresent) {
    findings.push({
      severity: "medium",
      title: "Missing docs directory",
      summary: "No docs, documentation, guides, handbook, or wiki directory was detected.",
      recommendation: "Create a docs directory for deeper guides once README content grows beyond quick-start material.",
      source: "rule"
    });
  }

  if (context.missingCommonSections.length > 0) {
    findings.push({
      severity: "medium",
      title: "Common documentation sections are missing",
      summary: `The scanned Markdown set is missing: ${context.missingCommonSections.join(", ")}.`,
      recommendation: "Add short sections for each missing area so new users can install, run, validate, and understand project limits.",
      source: "rule"
    });
  }

  if (missingH1.length > 0) {
    findings.push({
      severity: "medium",
      title: "Documents missing top-level titles",
      summary: `${missingH1.length} Markdown document(s) do not contain an H1 heading.`,
      recommendation: "Add exactly one clear H1 near the top of each page to improve scanning and generated navigation.",
      source: "rule"
    });
  }

  if (headingSkips.length > 0) {
    findings.push({
      severity: "medium",
      title: "Heading hierarchy skips detected",
      summary: `${headingSkips.length} heading hierarchy issue(s) were found, such as jumping from H1 to H3.`,
      recommendation: "Normalize headings so each page moves one level at a time and keeps sections easy to navigate.",
      source: "rule"
    });
  }

  if (brokenLinks.length > 0) {
    findings.push({
      severity: "high",
      title: "Broken local documentation links",
      summary: `${brokenLinks.length} local relative link(s) point to files that were not found.`,
      recommendation: "Update or remove broken local links before publishing the documentation report.",
      source: "rule"
    });
  }

  if (emptyDocuments.length > 0 || shortDocuments.length > 0) {
    findings.push({
      severity: "low",
      title: "Thin documentation pages detected",
      summary: `${emptyDocuments.length} empty and ${shortDocuments.length} very short Markdown document(s) were found.`,
      recommendation: "Merge placeholder pages into active docs or expand them with concrete setup, usage, and validation details.",
      source: "rule"
    });
  }

  return findings;
}

async function statRequired(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Target path does not exist: ${filePath}`);
    }

    throw error;
  }
}

async function readPackageSummary(root: string): Promise<DocsContext["project"]> {
  const packagePath = path.join(root, "package.json");

  if (!(await exists(packagePath))) {
    return {
      hasPackageJson: false,
      packageName: null,
      scripts: {}
    };
  }

  const raw = await fs.readFile(packagePath, "utf8");
  const parsed = JSON.parse(raw) as { name?: string; scripts?: Record<string, string> };

  return {
    hasPackageJson: true,
    packageName: parsed.name ?? null,
    scripts: parsed.scripts ?? {}
  };
}

async function walkFiles(root: string): Promise<string[]> {
  const output: string[] = [];

  async function visit(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const absolute = path.join(current, entry.name);
      const relative = toPosix(path.relative(root, absolute));

      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        output.push(relative);
      }
    }
  }

  await visit(root);
  return output.sort((a, b) => a.localeCompare(b));
}

async function summarizeDocuments(root: string, files: string[]): Promise<DocumentSummary[]> {
  const summaries = await Promise.all(
    files.map(async (file) => {
      const absolute = path.join(root, file);
      const [stats, content] = await Promise.all([fs.stat(absolute), fs.readFile(absolute, "utf8")]);
      const headings = extractHeadings(content);
      const title = headings.find((heading) => heading.level === 1)?.text ?? null;
      const relativeLinks = extractLocalRelativeLinks(content);
      const brokenLinks = await findBrokenLinks(root, file, relativeLinks);
      const words = countWords(content);
      const lines = content.length === 0 ? 0 : content.split(/\r?\n/).length;
      const issues = buildDocumentIssues(file, content, headings, brokenLinks, words);

      return {
        path: file,
        title,
        headings: headings.map((heading) => `${"#".repeat(heading.level)} ${heading.text}`),
        relativeLinks,
        brokenLinks,
        words,
        lines,
        bytes: stats.size,
        issues
      };
    })
  );

  return summaries.sort((a, b) => a.path.localeCompare(b.path));
}

async function readTopLevelDirs(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function extractHeadings(content: string): Array<{ level: number; text: string }> {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      level: match[1].length,
      text: match[2].trim()
    }));
}

function extractLocalRelativeLinks(content: string): string[] {
  const links: string[] = [];

  for (const match of content.matchAll(LOCAL_LINK_PATTERN)) {
    const raw = match[1].trim();

    if (isLocalRelativeLink(raw)) {
      links.push(raw);
    }
  }

  return links;
}

function isLocalRelativeLink(raw: string): boolean {
  if (raw.length === 0 || raw.startsWith("#")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return false;
  if (raw.startsWith("//")) return false;

  return true;
}

async function findBrokenLinks(root: string, documentPath: string, links: string[]): Promise<string[]> {
  const documentDir = path.dirname(path.join(root, documentPath));
  const broken: string[] = [];

  for (const link of links) {
    const withoutAnchor = link.split("#")[0];
    const withoutQuery = withoutAnchor.split("?")[0];

    if (withoutQuery.length === 0) {
      continue;
    }

    const resolved = path.resolve(documentDir, decodeURIComponent(withoutQuery));

    if (!isInsideRoot(root, resolved) || !(await exists(resolved))) {
      broken.push(link);
    }
  }

  return broken;
}

function buildDocumentIssues(
  file: string,
  content: string,
  headings: Array<{ level: number; text: string }>,
  brokenLinks: string[],
  words: number
): DocumentIssue[] {
  const issues: DocumentIssue[] = [];

  if (content.trim().length === 0) {
    issues.push({
      type: "empty",
      path: file,
      detail: "Document is empty."
    });
  } else if (words < 30) {
    issues.push({
      type: "too-short",
      path: file,
      detail: `Document has only ${words} words.`
    });
  }

  if (!headings.some((heading) => heading.level === 1)) {
    issues.push({
      type: "missing-h1",
      path: file,
      detail: "Document has no H1 heading."
    });
  }

  let previousLevel = 0;
  for (const heading of headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      issues.push({
        type: "heading-skip",
        path: file,
        detail: `Heading "${heading.text}" jumps from H${previousLevel} to H${heading.level}.`
      });
    }
    previousLevel = heading.level;
  }

  for (const link of brokenLinks) {
    issues.push({
      type: "broken-link",
      path: file,
      detail: `Broken local link: ${link}`
    });
  }

  return issues;
}

function findMissingCommonSections(documents: DocumentSummary[]): string[] {
  const searchable = documents.flatMap((document) => [document.title ?? "", ...document.headings]).join("\n");

  return COMMON_SECTION_PATTERNS.filter((section) => !section.pattern.test(searchable)).map((section) => section.label);
}

function buildCoverageSignals(
  documents: DocumentSummary[],
  readmePresent: boolean,
  docsDirPresent: boolean,
  missingCommonSections: string[]
): string[] {
  const signals: string[] = [];

  if (!readmePresent) signals.push("missing README");
  if (!docsDirPresent) signals.push("missing docs directory");
  if (documents.length === 0) signals.push("no Markdown documents");
  if (missingCommonSections.length > 0) signals.push(`missing sections: ${missingCommonSections.join(", ")}`);

  return signals;
}

function buildQualitySignals(documents: DocumentSummary[]): string[] {
  const signals: string[] = [];
  const brokenLinks = documents.reduce((count, document) => count + document.brokenLinks.length, 0);
  const missingH1 = documents.filter((document) => document.issues.some((issue) => issue.type === "missing-h1")).length;
  const headingSkips = documents.reduce(
    (count, document) => count + document.issues.filter((issue) => issue.type === "heading-skip").length,
    0
  );
  const thinDocs = documents.filter((document) =>
    document.issues.some((issue) => issue.type === "empty" || issue.type === "too-short")
  ).length;

  if (brokenLinks > 0) signals.push(`${brokenLinks} broken local link(s)`);
  if (missingH1 > 0) signals.push(`${missingH1} document(s) missing H1`);
  if (headingSkips > 0) signals.push(`${headingSkips} heading hierarchy skip(s)`);
  if (thinDocs > 0) signals.push(`${thinDocs} thin document(s)`);

  return signals;
}

function buildRiskyAreas(
  documents: DocumentSummary[],
  readmePresent: boolean,
  docsDirPresent: boolean,
  missingCommonSections: string[]
): string[] {
  const risks: string[] = [];
  const largest = documents.slice().sort((a, b) => b.words - a.words)[0];
  const brokenLinks = documents.flatMap((document) => document.brokenLinks.map((link) => `${document.path} -> ${link}`));

  if (!readmePresent) risks.push("missing README");
  if (!docsDirPresent) risks.push("missing docs directory");
  if (missingCommonSections.length > 0) risks.push(`missing common sections: ${missingCommonSections.join(", ")}`);
  if (largest && largest.words >= 800) risks.push(`large document: ${largest.path}`);
  if (brokenLinks.length > 0) risks.push(`broken links: ${brokenLinks.slice(0, 3).join(", ")}`);

  return risks;
}

function renderFindings(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return ["No findings detected."];
  }

  return findings.flatMap((finding) => [
    `### [${finding.severity.toUpperCase()}] ${finding.title}`,
    "",
    `- Source: ${finding.source}`,
    `- Summary: ${finding.summary}`,
    `- Recommendation: ${finding.recommendation}`,
    ""
  ]);
}

function renderDocuments(documents: DocumentSummary[]): string[] {
  if (documents.length === 0) {
    return ["No Markdown documents detected."];
  }

  return documents.map(
    (document) =>
      `- \`${document.path}\`: ${document.words} words, ${document.lines} lines, ${document.brokenLinks.length} broken links`
  );
}

function countWords(content: string): number {
  const matches = content.match(/[\p{L}\p{N}_-]+/gu);
  return matches?.length ?? 0;
}

function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

