export type FindingSeverity = "low" | "medium" | "high";

export interface DocumentIssue {
  type: "missing-h1" | "heading-skip" | "empty" | "too-short" | "broken-link";
  path: string;
  detail: string;
}

export interface DocumentSummary {
  path: string;
  title: string | null;
  headings: string[];
  relativeLinks: string[];
  brokenLinks: string[];
  words: number;
  lines: number;
  bytes: number;
  issues: DocumentIssue[];
}

export interface DocsStructure {
  topLevelDirs: string[];
  totalFiles: number;
  markdownFiles: number;
  docsDirPresent: boolean;
  readmePresent: boolean;
  largestDocuments: DocumentSummary[];
  riskyAreas: string[];
}

export interface DocsContext {
  targetPath: string;
  generatedAt: string;
  project: {
    hasPackageJson: boolean;
    packageName: string | null;
    scripts: Record<string, string>;
  };
  structure: DocsStructure;
  documents: DocumentSummary[];
  coverageSignals: string[];
  qualitySignals: string[];
  missingCommonSections: string[];
}

export interface Finding {
  severity: FindingSeverity;
  title: string;
  summary: string;
  recommendation: string;
  source: "rule" | "mock-ai" | "gemini" | "mimo";
}

export interface ReviewResult {
  ruleFindings: Finding[];
  aiFindings: Finding[];
}

export interface AnalyzeOptions {
  target: string;
  out: string;
  provider?: "mock" | "gemini";
  model?: string;
}

export interface AnalyzeResult {
  outputPath: string;
  context: DocsContext;
  review: ReviewResult;
  report: string;
}

