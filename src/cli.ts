#!/usr/bin/env node
import { Command } from "commander";
import { analyzeDocumentation } from "./analyze.js";
import { listGeminiGenerateContentModels } from "./providers.js";

const program = new Command();

program
  .name("docpilot")
  .description("AI-agent assisted Markdown documentation analysis CLI")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze Markdown documentation and write a Markdown report")
  .option("--target <path>", "project or documentation path to scan", ".")
  .option("--out <file>", "Markdown report output path", "reports/docpilot-report.md")
  .option("--provider <name>", "AI provider to use: mock or gemini", "mock")
  .option("--model <name>", "model name for provider-backed analysis")
  .action(async (options: { target: string; out: string; provider: string; model?: string }) => {
    try {
      if (options.provider !== "mock" && options.provider !== "gemini") {
        throw new Error(`Unsupported provider: ${options.provider}`);
      }

      const result = await analyzeDocumentation({
        target: options.target,
        out: options.out,
        provider: options.provider,
        model: options.model
      });

      console.log(`DocPilot report written to ${result.outputPath}`);
      console.log(
        `Scanned ${result.context.structure.markdownFiles} Markdown files and produced ${result.review.ruleFindings.length + result.review.aiFindings.length} findings.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`DocPilot analyze failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("models")
  .description("List Gemini models available to this API key that support generateContent")
  .action(async () => {
    try {
      const models = await listGeminiGenerateContentModels();

      if (models.length === 0) {
        console.log("No Gemini models supporting generateContent were returned for this API key.");
        return;
      }

      for (const model of models) {
        console.log(`${model.name}\t${model.displayName}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`DocPilot models failed: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();
