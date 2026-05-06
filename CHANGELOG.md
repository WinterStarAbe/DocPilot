# Changelog

## v0.1.0 - 2026-05-06

Initial DocPilot MVP release.

### Added

- TypeScript Node CLI with `docpilot analyze`.
- `docpilot models` command for listing Gemini models that support `generateContent`.
- Multi-Agent documentation review pipeline:
  - `ExplorerAgent` for Markdown, README, docs directory, headings, links, word counts, and common section coverage.
  - `ReviewerAgent` for rule findings plus provider-backed findings.
  - `ReportAgent` for Markdown report rendering.
- Provider boundary with `MockAiProvider`, `GeminiProvider`, and `MimoProvider` placeholder.
- Deterministic rule checks for missing README, missing docs directory, missing common sections, missing H1, heading hierarchy skips, broken local links, and thin docs.
- Self-analysis report at `reports/docpilot-report.md`.
- Gemini live model report at `reports/docpilot-gemini-report.md`.
- Intentionally broken documentation fixture at `examples/bad-docs`.
- Bad-docs detection report at `reports/bad-docs-report.md`.
- GitHub Actions CI for build, lint, tests, and self-analysis report artifact upload.
- MIT license.
- Architecture notes at `docs/architecture.md`.
- Incentive program application material at `docs/application.md`.

### Verified

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run analyze:self`
- `node dist/src/cli.js analyze --target examples/bad-docs --out reports/bad-docs-report.md`

