import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeDocumentation } from "../src/analyze.js";
import { ExplorerAgent } from "../src/agents.js";
import { createAiProvider, GeminiProvider } from "../src/providers.js";
import type { DocsContext } from "../src/types.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "docpilot-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

describe("DocPilot analysis", () => {
  it("scans a documentation project and writes a Markdown report", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "fixture-docs",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "vitest run",
          lint: "tsc -p tsconfig.json --noEmit"
        }
      },
      files: {
        "README.md": [
          "# Fixture",
          "",
          "## Installation",
          "Run npm install.",
          "",
          "## Usage",
          "Run the CLI.",
          "",
          "## Development",
          "Use focused changes.",
          "",
          "## Testing",
          "Run tests.",
          "",
          "## Roadmap",
          "Add more checks."
        ].join("\n"),
        "docs/guide.md": "# Guide\n\nUse [README](../README.md) for setup details.\n"
      }
    });

    const out = path.join(tempRoot, "reports", "report.md");
    const result = await analyzeDocumentation({ target: tempRoot, out });
    const report = await fs.readFile(out, "utf8");

    expect(result.context.project.packageName).toBe("fixture-docs");
    expect(result.context.structure.readmePresent).toBe(true);
    expect(result.context.structure.docsDirPresent).toBe(true);
    expect(result.context.structure.markdownFiles).toBe(2);
    expect(report).toContain("# DocPilot Documentation Analysis");
    expect(report).toContain("ExplorerAgent");
    expect(report).toContain("ReviewerAgent");
    expect(report).toContain("ReportAgent");
  });

  it("reports a missing README", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "missing-readme"
      },
      files: {
        "docs/guide.md": "# Guide\n\n## Usage\n\nRun the tool from the CLI.\n"
      }
    });

    const result = await analyzeDocumentation({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });

    expect(result.review.ruleFindings.some((finding) => finding.title === "Missing README")).toBe(true);
  });

  it("reports heading hierarchy skips", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "heading-skip"
      },
      files: {
        "README.md": "# Title\n\n### Skipped section\n\nDetails here.\n"
      }
    });

    const result = await analyzeDocumentation({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });

    expect(result.review.ruleFindings.some((finding) => finding.title === "Heading hierarchy skips detected")).toBe(
      true
    );
  });

  it("reports broken local relative links", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "broken-link"
      },
      files: {
        "README.md": "# Title\n\nSee [Missing](docs/missing.md).\n"
      }
    });

    const result = await analyzeDocumentation({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });

    expect(result.review.ruleFindings.some((finding) => finding.title === "Broken local documentation links")).toBe(
      true
    );
  });

  it("reports mock provider findings deterministically", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "thin-docs"
      },
      files: {
        "README.md": "# Thin\n"
      }
    });

    const result = await analyzeDocumentation({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });
    const titles = result.review.aiFindings.map((finding) => finding.title);

    expect(titles).toContain("Agent workflow is available but still deterministic");
    expect(titles).toContain("Documentation coverage should be expanded");
  });

  it("renders required report sections", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "section-report"
      },
      files: {
        "README.md": "# Section Report\n\n## Usage\n\nRun it.\n"
      }
    });

    const result = await analyzeDocumentation({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });

    expect(result.report).toContain("## 核心痛點");
    expect(result.report).toContain("## 掃描摘要");
    expect(result.report).toContain("## Agent 流程");
    expect(result.report).toContain("## 文件結構概覽");
    expect(result.report).toContain("## 發現項目");
    expect(result.report).toContain("## 建議下一步");
    expect(result.report).toContain("## 申請表成果描述草稿");
  });

  it("rejects a missing target path", async () => {
    const explorer = new ExplorerAgent();

    await expect(explorer.explore(path.join(tempRoot, "missing"))).rejects.toThrow("Target path does not exist");
  });

  it("rejects a target path that is not a directory", async () => {
    const filePath = path.join(tempRoot, "README.md");
    await fs.writeFile(filePath, "# File\n");
    const explorer = new ExplorerAgent();

    await expect(explorer.explore(filePath)).rejects.toThrow("Target path is not a directory");
  });

  it("requires GEMINI_API_KEY for the Gemini provider", () => {
    expect(() => createAiProvider({ provider: "gemini" })).toThrow("GEMINI_API_KEY is required");
  });

  it("parses Gemini findings from generateContent output", async () => {
    const originalFetch = globalThis.fetch;
    process.env.GEMINI_API_KEY = "test-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      findings: [
                        {
                          severity: "high",
                          title: "Broken onboarding",
                          summary: "The README does not describe installation.",
                          recommendation: "Add a short installation section."
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    try {
      const provider = new GeminiProvider({ model: "gemini-2.5-flash" });
      const findings = await provider.analyzeDocs(createContextFixture());

      expect(findings).toEqual([
        {
          severity: "high",
          title: "Broken onboarding",
          summary: "The README does not describe installation.",
          recommendation: "Add a short installation section.",
          source: "gemini"
        }
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("extracts Gemini findings when the model wraps JSON in text", async () => {
    const originalFetch = globalThis.fetch;
    process.env.GEMINI_API_KEY = "test-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: [
                      "Here is the analysis:",
                      "```json",
                      "[",
                      "  {",
                      "    \"severity\": \"medium\",",
                      "    \"title\": \"Add testing docs\",",
                      "    \"summary\": \"The docs should explain verification commands.\",",
                      "    \"recommendation\": \"Add a Testing section to README.md.\"",
                      "  }",
                      "]",
                      "```"
                    ].join("\n")
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    try {
      const provider = new GeminiProvider({ model: "gemini-2.5-flash" });
      const findings = await provider.analyzeDocs(createContextFixture());

      expect(findings[0]).toMatchObject({
        severity: "medium",
        title: "Add testing docs",
        source: "gemini"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to a Gemini prose finding when no JSON can be extracted", async () => {
    const originalFetch = globalThis.fetch;
    process.env.GEMINI_API_KEY = "test-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "* Role: ReviewerAgent\n* Finding: This project should add documentation validation."
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    try {
      const provider = new GeminiProvider({ model: "gemini-2.5-flash" });
      const findings = await provider.analyzeDocs(createContextFixture());

      expect(findings[0]).toMatchObject({
        severity: "medium",
        title: "Gemini returned prose instead of structured findings",
        source: "gemini"
      });
      expect(findings[0].summary).toContain("ReviewerAgent");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

async function writeProject(
  root: string,
  input: {
    packageJson: unknown;
    files: Record<string, string>;
  }
) {
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify(input.packageJson, null, 2));

  for (const [relativePath, content] of Object.entries(input.files)) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }
}

function createContextFixture(): DocsContext {
  return {
    targetPath: tempRoot,
    generatedAt: "2026-05-06T00:00:00.000Z",
    project: {
      hasPackageJson: true,
      packageName: "fixture-docs",
      scripts: {
        test: "vitest run"
      }
    },
    structure: {
      topLevelDirs: ["docs"],
      totalFiles: 3,
      markdownFiles: 2,
      docsDirPresent: true,
      readmePresent: true,
      largestDocuments: [],
      riskyAreas: []
    },
    documents: [
      {
        path: "README.md",
        title: "Fixture",
        headings: ["# Fixture", "## Usage"],
        relativeLinks: [],
        brokenLinks: [],
        words: 40,
        lines: 8,
        bytes: 120,
        issues: []
      }
    ],
    coverageSignals: [],
    qualitySignals: [],
    missingCommonSections: []
  };
}

