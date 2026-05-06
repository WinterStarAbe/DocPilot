# DocPilot Documentation Analysis

## 核心痛點

中小型專案的 README、docs 與開發說明常在快速迭代後變得分散、過期或缺少關鍵章節。DocPilot 透過多 Agent 流程把文件掃描、結構檢查與改善建議標準化，讓團隊能快速產出可提交、可審核的文件健康度報告。

## 掃描摘要

- Target: `E:\WorkSpace\CodeX\DocPilot\examples\bad-docs`
- Generated at: 2026-05-06T09:02:32.000Z
- Package name: n/a
- README: missing
- Docs directory: missing
- Total files: 2
- Markdown files: 2
- Missing common sections: installation/setup, usage, development workflow, testing, limitations/roadmap

## Agent 流程

1. ExplorerAgent: 掃描 Markdown 文件、README、docs 目錄、標題層級、相對連結與文件分布。
2. ReviewerAgent: 結合規則式檢查與 AI provider findings，判斷文件缺口與維護風險。
3. ReportAgent: 將掃描結果、風險與建議整理成可提交的 Markdown 報告。

## 文件結構概覽

- Top-level directories: none
- Coverage signals: missing README; missing docs directory; missing sections: installation/setup, usage, development workflow, testing, limitations/roadmap
- Quality signals: 1 broken local link(s); 1 document(s) missing H1; 1 heading hierarchy skip(s); 2 thin document(s)
- Risky areas: missing README; missing docs directory; missing common sections: installation/setup, usage, development workflow, testing, limitations/roadmap; broken links: guide.md -> setup.md

### Largest documents

- `guide.md`: 12 words, 7 lines, 1 broken links
- `notes.md`: 1 words, 3 lines, 0 broken links

## 發現項目

### [HIGH] Missing README

- Source: rule
- Summary: No README document was found at the project root or scanned Markdown set.
- Recommendation: Add README.md with project purpose, setup, usage, validation commands, and limitations.

### [MEDIUM] Missing docs directory

- Source: rule
- Summary: No docs, documentation, guides, handbook, or wiki directory was detected.
- Recommendation: Create a docs directory for deeper guides once README content grows beyond quick-start material.

### [MEDIUM] Common documentation sections are missing

- Source: rule
- Summary: The scanned Markdown set is missing: installation/setup, usage, development workflow, testing, limitations/roadmap.
- Recommendation: Add short sections for each missing area so new users can install, run, validate, and understand project limits.

### [MEDIUM] Documents missing top-level titles

- Source: rule
- Summary: 1 Markdown document(s) do not contain an H1 heading.
- Recommendation: Add exactly one clear H1 near the top of each page to improve scanning and generated navigation.

### [MEDIUM] Heading hierarchy skips detected

- Source: rule
- Summary: 1 heading hierarchy issue(s) were found, such as jumping from H1 to H3.
- Recommendation: Normalize headings so each page moves one level at a time and keeps sections easy to navigate.

### [HIGH] Broken local documentation links

- Source: rule
- Summary: 1 local relative link(s) point to files that were not found.
- Recommendation: Update or remove broken local links before publishing the documentation report.

### [LOW] Thin documentation pages detected

- Source: rule
- Summary: 0 empty and 2 very short Markdown document(s) were found.
- Recommendation: Merge placeholder pages into active docs or expand them with concrete setup, usage, and validation details.

### [MEDIUM] Agent workflow is available but still deterministic

- Source: mock-ai
- Summary: The current MVP routes documentation context through a provider interface, which proves the AI orchestration boundary without requiring a live model key.
- Recommendation: Connect the provider interface to the target incentive-program model once credentials and rate limits are available, then compare model findings with rule findings.

### [MEDIUM] Documentation coverage should be expanded

- Source: mock-ai
- Summary: The current docs are missing common sections: installation/setup, usage, development workflow, testing, limitations/roadmap.
- Recommendation: Prioritize concise installation, usage, testing, and roadmap sections because they make the MVP easier to evaluate.


## 建議下一步

- 使用 `--provider gemini` 與 `GEMINI_API_KEY` 產生真實模型 findings，將 mock findings 替換為 Gemini 推理結果。
- 保留 MimoProvider placeholder，等指定模型 API key 可用後再接入同一個 provider 介面。
- 增加章節模板產生器，針對缺少的安裝、使用、測試與後續路線章節產生初稿。
- 將文件健康度報告接到 CI artifact 或 release checklist，形成文件維護閉環。

## 申請表成果描述草稿

我構建了一個名為 DocPilot 的 AI 多 Agent 文件健康度分析 CLI，用於解決專案文件分散、README 缺漏、章節不完整、相對連結失效與文件維護成本過高的問題。系統由 ExplorerAgent、ReviewerAgent 與 ReportAgent 協作，先掃描 Markdown 文件、README、docs 目錄、標題層級、相對連結與常見章節覆蓋，再結合規則式檢查與可插拔 AI provider 產生風險 findings，最後輸出 Markdown 分析報告。第一版使用穩定的 MockAiProvider 驗證 Agent 流程，並已支援透過 GEMINI_API_KEY 啟用 GeminiProvider 產生真實模型 findings；MimoProvider 則保留為同一介面的後續接入點。
