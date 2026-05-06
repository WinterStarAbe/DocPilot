# DocPilot

DocPilot is an AI-agent assisted Markdown documentation analysis CLI for turning scattered project docs into reviewable documentation health reports.

Repository: <https://github.com/WinterStarAbe/DocPilot>

## Why It Exists

Small projects often ship code faster than they update README files, docs directories, onboarding steps, testing instructions, and roadmap notes. DocPilot makes documentation review repeatable: it scans Markdown files, checks common documentation gaps, optionally asks a live AI model for findings, and writes a Markdown report that can be used as demo evidence or incentive program submission material.

## MVP Evidence

| Evidence | Path | What it proves |
| --- | --- | --- |
| Self-analysis report | `reports/docpilot-report.md` | DocPilot can scan its own repo and produce a stable mock-provider report. |
| Gemini live model report | `reports/docpilot-gemini-report.md` | The same Agent flow can call a real Gemini model through the provider interface. |
| Bad-docs fixture report | `reports/bad-docs-report.md` | Rule checks detect missing README, missing docs directory, broken links, heading skips, and thin docs. |
| Application material | `docs/application.md` | Chinese incentive-program project description and implementation narrative. |
| Architecture notes | `docs/architecture.md` | CLI, Agent, provider, and report data flow overview. |
| CI workflow | `.github/workflows/ci.yml` | Build, lint, tests, and self-analysis run in GitHub Actions. |

## Quick Demo

DocPilot can analyze its own repository and produce a submission-ready report:

```bash
npm run analyze:self
```

It can also analyze an intentionally broken fixture:

```bash
node dist/src/cli.js analyze --target examples/bad-docs --out reports/bad-docs-report.md
```

The fixture demonstrates missing README detection, missing docs directory detection, heading hierarchy checks, broken local link detection, and thin-document findings.

## Getting Started

```bash
npm install
npm run build
npm run lint
npm test
npm run analyze:self
```

## CLI Usage

```bash
docpilot analyze --target . --out reports/docpilot-report.md
```

Defaults:

- `--target .`
- `--out reports/docpilot-report.md`
- `--provider mock`

Use Gemini when `GEMINI_API_KEY` is available:

```bash
GEMINI_API_KEY=your-key node dist/src/cli.js analyze --provider gemini --model gemini-2.5-flash --out reports/docpilot-gemini-report.md
```

PowerShell:

```powershell
$env:GEMINI_API_KEY = "your-key"
node dist/src/cli.js analyze --provider gemini --model gemini-2.5-flash --out reports/docpilot-gemini-report.md
```

The Gemini report is intentionally not checked in by default because it depends on a live API key and model output.

List Gemini models available to your API key that support `generateContent`:

```powershell
$env:GEMINI_API_KEY = "your-key"
node dist/src/cli.js models
```

Use a model name from that list with `--model`. If a model returns 404, it is not available to your key/API version or does not support `generateContent`. If it returns 503 or 500, retry later or choose another listed model.

## Agent Flow

1. `ExplorerAgent` scans Markdown files, README presence, docs directory presence, heading hierarchy, local relative links, word counts, and common section coverage.
2. `ReviewerAgent` combines rule-based checks with a pluggable AI provider.
3. `ReportAgent` renders the final Markdown report.

The MVP uses `MockAiProvider` for stable repeatable output, supports `GeminiProvider` through `GEMINI_API_KEY`, and keeps a `MimoProvider` placeholder for future MiMo API integration.

## Development

```bash
npm ci
npm run build
npm run lint
npm test
npm run analyze:self
```

## Testing

DocPilot uses Vitest for unit coverage around scanning, rule findings, provider parsing, and report rendering.

GitHub Actions runs build, lint, tests, self-analysis, and uploads the generated DocPilot report as a workflow artifact.

## Roadmap

- Add a template generation agent for missing documentation sections.
- Add CI artifact publishing for generated documentation reports.
- Connect the placeholder MiMo provider when live API access is available.
