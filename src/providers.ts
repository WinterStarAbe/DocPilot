import type { DocsContext, Finding } from "./types.js";

export interface AiProvider {
  analyzeDocs(context: DocsContext): Promise<Finding[]>;
}

export type ProviderName = "mock" | "gemini";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class MockAiProvider implements AiProvider {
  async analyzeDocs(context: DocsContext): Promise<Finding[]> {
    const findings: Finding[] = [
      {
        severity: "medium",
        title: "Agent workflow is available but still deterministic",
        summary:
          "The current MVP routes documentation context through a provider interface, which proves the AI orchestration boundary without requiring a live model key.",
        recommendation:
          "Connect the provider interface to the target incentive-program model once credentials and rate limits are available, then compare model findings with rule findings.",
        source: "mock-ai"
      }
    ];

    if (context.structure.markdownFiles === 0) {
      findings.push({
        severity: "high",
        title: "No documentation corpus detected",
        summary:
          "The scanned target does not currently include Markdown documentation, so the tool can only report structural gaps.",
        recommendation: "Add README.md and a docs directory before using AI findings as a documentation improvement workflow.",
        source: "mock-ai"
      });
    }

    if (context.missingCommonSections.length > 0) {
      findings.push({
        severity: "medium",
        title: "Documentation coverage should be expanded",
        summary: `The current docs are missing common sections: ${context.missingCommonSections.join(", ")}.`,
        recommendation:
          "Prioritize concise installation, usage, testing, and roadmap sections because they make the MVP easier to evaluate.",
        source: "mock-ai"
      });
    }

    return findings;
  }
}

export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpointBase: string;

  constructor(input?: { apiKey?: string; model?: string; endpointBase?: string }) {
    const apiKey = input?.apiKey ?? process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when using the gemini provider.");
    }

    this.apiKey = apiKey;
    this.model = input?.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    this.endpointBase = input?.endpointBase ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async analyzeDocs(context: DocsContext): Promise<Finding[]> {
    const response = await fetch(`${this.endpointBase}/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildGeminiPrompt(context)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API request failed with ${response.status}: ${body}`);
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;

    if (!text) {
      throw new Error("Gemini API response did not contain text output.");
    }

    if (process.env.DOCPILOT_DEBUG_AI === "1") {
      console.error("Gemini raw text output:");
      console.error(text);
    }

    return parseGeminiFindings(text);
  }
}

export class MimoProvider implements AiProvider {
  async analyzeDocs(): Promise<Finding[]> {
    throw new Error("MimoProvider is reserved for the live MiMo API integration and is not configured in the MVP.");
  }
}

export function createAiProvider(input?: { provider?: ProviderName; model?: string }): AiProvider {
  if (input?.provider === "gemini") {
    return new GeminiProvider({ model: input.model });
  }

  return new MockAiProvider();
}

function buildGeminiPrompt(context: DocsContext): string {
  return [
    "You are DocPilot's ReviewerAgent.",
    "Analyze this Markdown documentation context and return JSON only.",
    "Return an array of 1 to 5 findings. Each finding must include severity, title, summary, and recommendation.",
    "Severity must be one of: low, medium, high.",
    "",
    JSON.stringify(
      {
        project: context.project,
        structure: context.structure,
        documents: context.documents.map((document) => ({
          path: document.path,
          title: document.title,
          words: document.words,
          headings: document.headings.slice(0, 12),
          brokenLinks: document.brokenLinks,
          issues: document.issues
        })),
        coverageSignals: context.coverageSignals,
        qualitySignals: context.qualitySignals,
        missingCommonSections: context.missingCommonSections
      },
      null,
      2
    )
  ].join("\n");
}

function parseGeminiFindings(text: string): Finding[] {
  const parsed = parseGeminiJsonOrFallback(text);
  const rawFindings = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.findings)
      ? parsed.findings
      : [];

  return rawFindings
    .filter(isRecord)
    .map((finding) => ({
      severity: normalizeSeverity(finding.severity),
      title: normalizeText(finding.title, "Gemini documentation finding"),
      summary: normalizeText(finding.summary, "Gemini identified a documentation risk."),
      recommendation: normalizeText(finding.recommendation, "Review this area before publishing the documentation."),
      source: "gemini" as const
    }))
    .slice(0, 5);
}

function parseGeminiJsonOrFallback(text: string): unknown {
  try {
    return JSON.parse(extractJsonPayload(text)) as unknown;
  } catch {
    return [
      {
        severity: "medium",
        title: "Gemini returned prose instead of structured findings",
        summary: summarizePlainText(text),
        recommendation:
          "Review the prose response and retry with the same model, a lower temperature, or a model that follows JSON output more consistently."
      }
    ];
  }
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      const candidate = fenced[1].trim();
      JSON.parse(candidate);
      return candidate;
    }

    const arrayCandidate = extractBalancedJson(trimmed, "[", "]");
    if (arrayCandidate) {
      JSON.parse(arrayCandidate);
      return arrayCandidate;
    }

    const objectCandidate = extractBalancedJson(trimmed, "{", "}");
    if (objectCandidate) {
      JSON.parse(objectCandidate);
      return objectCandidate;
    }

    throw new Error("Gemini API response was not valid JSON and no JSON payload could be extracted.");
  }
}

function extractBalancedJson(text: string, openChar: "[" | "{", closeChar: "]" | "}"): string | null {
  const start = text.indexOf(openChar);

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeSeverity(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function summarizePlainText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return "Gemini returned an empty prose response.";
  }

  return normalized.length <= 500 ? normalized : `${normalized.slice(0, 497)}...`;
}

