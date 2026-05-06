# DocPilot 激勵計畫申請材料

## 項目一句話

DocPilot 是一個 AI 多 Agent Markdown 文件健康度分析 CLI，能掃描專案文件、README、docs 目錄、標題層級、相對連結與常見章節覆蓋，並結合 Gemini API 產生文件缺口與維護風險報告。

## 可直接貼到申請表的成果描述

我構建了一個名為 DocPilot 的 AI 多 Agent 文件健康度分析工具，用於解決專案文件分散、README 缺漏、章節不完整、相對連結失效與文件維護成本過高的問題。

DocPilot 以 CLI 形式運作，可對指定 repository 或文件目錄執行自動掃描，分析 Markdown 文件數量、README 是否存在、docs 目錄是否存在、標題層級、相對連結、字數、最大文件、空文件、過短文件與常見章節覆蓋。系統內部採用多 Agent 流程：`ExplorerAgent` 負責收集文件結構與品質訊號，`ReviewerAgent` 負責結合規則式檢查與 AI provider 產生 findings，`ReportAgent` 負責輸出可提交、可審核的 Markdown 分析報告。

目前 MVP 已支援兩種 AI provider：`MockAiProvider` 用於穩定測試與可重現 demo，`GeminiProvider` 可透過 `GEMINI_API_KEY` 呼叫 Gemini API 產生真實模型 findings。MiMo provider 已保留同一介面的 placeholder，後續取得 MiMo API key 後可直接接入。整體流程包含長鏈分析步驟：掃描文件結構、建立文件上下文、執行規則檢查、呼叫 AI provider、解析模型輸出、整理 findings、生成 Markdown 報告。目前已完成自舉 demo，可用 DocPilot 掃描 DocPilot 自身 repo 並產生 `reports/docpilot-report.md` 作為成果證明。

## 核心痛點

- 專案文件通常分散在 README、docs 與零散 Markdown 中，人工盤點耗時且容易漏掉。
- 文件更新常落後於程式碼，導致安裝、使用、測試與限制說明不完整。
- 相對連結失效與標題層級混亂會降低文件可讀性與可維護性。
- AI coding 工具若只停留在聊天層，難以形成可驗證的文件改善閉環。

## 核心邏輯流

1. 使用者執行 CLI：

   ```powershell
   node dist/src/cli.js analyze --provider gemini
   ```

2. `ExplorerAgent` 掃描文件：
   - README 是否存在
   - docs 目錄是否存在
   - Markdown 文件數量
   - 標題層級
   - 相對連結與本地連結有效性
   - 字數、最大文件、空文件與過短文件
   - 安裝、使用、開發、測試與後續路線章節覆蓋

3. `ReviewerAgent` 執行兩層分析：
   - 規則式 findings：例如缺少 README、缺少 docs 目錄、標題跳級、失效連結、缺少常見章節。
   - AI findings：透過 Gemini API 分析 docs context，回傳文件維護風險與建議。

4. `ReportAgent` 輸出 Markdown 報告：
   - 核心痛點
   - 掃描摘要
   - Agent 流程
   - 文件結構概覽
   - 發現項目
   - 建議下一步
   - 申請表成果描述草稿

## 已完成證據

- CLI 指令：

  ```powershell
  node dist/src/cli.js analyze --provider mock
  ```

- 報告輸出：

  ```text
  reports/docpilot-report.md
  ```

- 驗證指令：

  ```powershell
  npm run build
  npm run lint
  npm test
  npm run analyze:self
  ```

## Provider 設計

DocPilot 沒有把模型寫死在流程中，而是設計了可插拔 provider 介面：

```ts
interface AiProvider {
  analyzeDocs(context: DocsContext): Promise<Finding[]>;
}
```

目前 provider 狀態：

- `MockAiProvider`: 穩定、可測試、可重現。
- `GeminiProvider`: 已可透過 `GEMINI_API_KEY` 呼叫 Gemini API。
- `MimoProvider`: 保留 placeholder，後續可用同一介面接入 MiMo API。

## 後續路線

1. 接入 MiMo API，讓同一份 docs context 可由 MiMo 模型產生 findings。
2. 增加章節模板產生器，針對缺少的安裝、使用、測試與後續路線章節產生初稿。
3. 增加文件修復建議 agent，針對高信心 findings 產生最小修改建議。
4. 加入 CI workflow，讓每次 push 都自動執行 build、lint、test 與自舉文件分析。
