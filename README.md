# DocPilot

DocPilot is an AI-agent assisted Markdown documentation analysis CLI. It scans a project or documentation directory, runs a deterministic multi-agent review flow, and writes a Markdown report that can be used for documentation debt review, demo material, or AI incentive program submissions.

## Getting Started

```bash
npm install
npm run build
npm run lint
npm test
npm run analyze:self
```

## CLI

```bash
docpilot analyze --target . --out reports/docpilot-report.md
```

Defaults:

- `--target .`
- `--out reports/docpilot-report.md`
- `--provider mock`

Use Gemini when `GEMINI_API_KEY` is available:

```bash
GEMINI_API_KEY=your-key docpilot analyze --provider gemini --model gemini-2.5-flash
```

PowerShell:

```powershell
$env:GEMINI_API_KEY = "your-key"
docpilot analyze --provider gemini --model gemini-2.5-flash
```

## Agent Flow

1. `ExplorerAgent` scans Markdown files, README presence, docs directory presence, heading hierarchy, local relative links, word counts, and common section coverage.
2. `ReviewerAgent` combines rule-based checks with a pluggable AI provider.
3. `ReportAgent` renders the final Markdown report.

The MVP uses `MockAiProvider` for stable repeatable output, supports `GeminiProvider` through `GEMINI_API_KEY`, and keeps a `MimoProvider` placeholder for future MiMo API integration.

## Development

```bash
npm run build
npm run lint
npm test
```

## Testing

DocPilot uses Vitest for unit coverage around scanning, rule findings, provider parsing, and report rendering.

## Roadmap

- Add a template generation agent for missing documentation sections.
- Add CI artifact publishing for generated documentation reports.
- Connect the placeholder MiMo provider when live API access is available.

