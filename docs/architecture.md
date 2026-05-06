# DocPilot Architecture

DocPilot is a small TypeScript CLI organized around a deterministic Agent pipeline. The MVP keeps the core flow local and testable, while using a provider interface for live model-backed findings.

## CLI Flow

The CLI entrypoint is `src/cli.ts`.

Primary commands:

- `docpilot analyze`: scan Markdown documentation and write a Markdown report.
- `docpilot models`: list Gemini models available to the configured API key that support `generateContent`.

The `analyze` command accepts:

- `--target <path>`: project or documentation path to scan.
- `--out <file>`: Markdown report output path.
- `--provider <mock|gemini>`: finding provider.
- `--model <name>`: model name for provider-backed analysis.

## Agent Pipeline

`ExplorerAgent` reads the target directory and builds a `DocsContext`.

It collects:

- README presence.
- docs-like directory presence.
- Markdown file count.
- headings and heading hierarchy issues.
- local relative links and broken local links.
- word counts, line counts, and thin documents.
- common section coverage for installation, usage, development, testing, and roadmap notes.

`ReviewerAgent` turns the context into findings.

It combines:

- rule findings for deterministic checks.
- AI findings from the selected provider.

`ReportAgent` renders the context and findings into a Markdown report with:

- core pain point.
- scan summary.
- Agent flow.
- documentation structure overview.
- findings.
- recommended next steps.
- incentive-program description draft.

## Provider Boundary

Providers implement one interface:

```ts
interface AiProvider {
  analyzeDocs(context: DocsContext): Promise<Finding[]>;
}
```

Current providers:

- `MockAiProvider`: stable, deterministic findings for tests and repeatable demos.
- `GeminiProvider`: calls Gemini `generateContent` with JSON-mode output and parses model findings.
- `MimoProvider`: placeholder for a future live MiMo API integration.

The CLI never depends on a specific model directly. It asks `createAiProvider` for a provider, and the provider returns normalized findings.

## Evidence Flow

DocPilot produces three useful reports:

- `reports/docpilot-report.md`: self-analysis using the mock provider.
- `reports/docpilot-gemini-report.md`: self-analysis using a live Gemini model.
- `reports/bad-docs-report.md`: intentionally broken fixture report showing rule-based detections.

GitHub Actions runs build, lint, tests, and self-analysis on push and pull request. The generated self-analysis report is uploaded as a CI artifact.

## Design Constraints

- Keep the MVP CLI-first, not Web UI-first.
- Keep rule checks deterministic and covered by tests.
- Keep live model output behind a provider boundary.
- Do not require a live API key for normal build, test, or CI validation.
- Treat generated reports as review evidence, not hidden side effects.

