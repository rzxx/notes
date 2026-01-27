import { LEVELS, type Fixture } from "./generator";
import { applyMutations, buildMutationScript } from "./mutations";
import { VARIANTS, buildFlatRows, makeRuntimeStore, type VariantConfig } from "./store";

type Stage = "cold" | "mutate" | "post";

type StageStats = {
  meanMs: number;
  p95Ms: number;
  samples: number[];
};

type ScenarioResult = {
  level: string;
  variant: string;
  iterations: number;
  stats: Record<Stage, StageStats>;
  peakRssMb: number;
  coldRows: number;
  postRows: number;
  note?: string;
  failed?: string;
};

const DEFAULT_ITERATIONS = 5;
const STRESS_ITERATIONS = 3;

const isMain =
  typeof import.meta !== "undefined" && (import.meta as ImportMeta & { main?: boolean }).main;
if (isMain) {
  runBenchmarks();
}

function runBenchmarks() {
  const results: ScenarioResult[] = [];

  for (const fixture of LEVELS) {
    const script = buildMutationScript(fixture);

    for (const [variant, config] of Object.entries(VARIANTS)) {
      const iterations = pickIterations(fixture);
      const scenario = safeRunScenario(fixture, script, variant, config, iterations);
      results.push(scenario);
      printScenario(scenario);
    }
  }

  printSummary(results);
}

function safeRunScenario(
  fixture: Fixture,
  script: ReturnType<typeof buildMutationScript>,
  variant: string,
  config: VariantConfig,
  iterations: number,
): ScenarioResult {
  try {
    return runScenario(fixture, script, variant, config, iterations);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      level: fixture.label,
      variant,
      iterations: 0,
      stats: {
        cold: emptyStats(),
        mutate: emptyStats(),
        post: emptyStats(),
      },
      peakRssMb: 0,
      coldRows: 0,
      postRows: 0,
      failed: message,
    };
  }
}

function runScenario(
  fixture: Fixture,
  script: ReturnType<typeof buildMutationScript>,
  variant: string,
  config: VariantConfig,
  iterations: number,
): ScenarioResult {
  const coldSamples: number[] = [];
  const mutateSamples: number[] = [];
  const postSamples: number[] = [];
  let peakRssMb = 0;

  let coldRows = 0;
  let postRows = 0;

  for (let i = 0; i < iterations; i++) {
    const coldStore = makeRuntimeStore(fixture.store, config);
    const coldTiming = measureMs(() => buildFlatRows(coldStore));
    coldSamples.push(coldTiming.durationMs);
    if (i === 0) coldRows = coldTiming.result.length;

    const mutationStore = makeRuntimeStore(fixture.store, config);
    const mutateTiming = measureMs(() => applyMutations(mutationStore, script));
    mutateSamples.push(mutateTiming.durationMs);

    const postTiming = measureMs(() => buildFlatRows(mutationStore));
    postSamples.push(postTiming.durationMs);
    if (i === 0) postRows = postTiming.result.length;

    peakRssMb = Math.max(peakRssMb, currentRssMb());
  }

  return {
    level: fixture.label,
    variant,
    iterations,
    stats: {
      cold: summarize(coldSamples),
      mutate: summarize(mutateSamples),
      post: summarize(postSamples),
    },
    peakRssMb,
    coldRows,
    postRows,
    note: fixture.targetNodes >= 250_000 ? "stress-level iterations capped" : undefined,
  };
}

function pickIterations(fixture: Fixture): number {
  return fixture.targetNodes >= 200_000 ? STRESS_ITERATIONS : DEFAULT_ITERATIONS;
}

function measureMs<T>(fn: () => T): { durationMs: number; result: T } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { durationMs, result };
}

function summarize(samples: number[]): StageStats {
  if (!samples.length) return emptyStats();
  const total = samples.reduce((sum, value) => sum + value, 0);
  const meanMs = total / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95Ms = sorted[p95Index];
  return { meanMs, p95Ms, samples };
}

function emptyStats(): StageStats {
  return { meanMs: 0, p95Ms: 0, samples: [] };
}

function currentRssMb(): number {
  const { rss } = process.memoryUsage();
  return Math.round((rss / 1024 / 1024) * 10) / 10;
}

function printScenario(result: ScenarioResult) {
  const header = `${result.level} | ${result.variant}`;

  if (result.failed) {
    console.error(`${header} | failed: ${result.failed}`);
    return;
  }

  const parts = [
    `iters=${result.iterations}`,
    formatStage("cold", result.stats.cold),
    formatStage("mutation", result.stats.mutate),
    formatStage("post", result.stats.post),
    `rows ${result.coldRows}→${result.postRows}`,
    `peakRSS ${result.peakRssMb.toFixed(1)}MB`,
  ];

  if (result.note) parts.push(result.note);

  console.log(`${header} | ${parts.join(" | ")}`);
}

function formatStage(label: string, stats: StageStats): string {
  if (!stats.samples.length) return `${label}=n/a`;
  return `${label} ${formatMs(stats.meanMs)}/p95 ${formatMs(stats.p95Ms)}`;
}

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  if (value >= 10) return `${value.toFixed(1)}ms`;
  return `${value.toFixed(2)}ms`;
}

function printSummary(results: ScenarioResult[]) {
  const failures = results.filter((r) => r.failed);
  if (failures.length) {
    console.error("\nFailures:");
    for (const fail of failures) {
      console.error(`- ${fail.level}/${fail.variant}: ${fail.failed}`);
    }
  }

  const stressNotes = results.filter((r) => r.note && r.note.includes("stress-level"));
  if (stressNotes.length) {
    console.log("\nNotes:");
    for (const note of stressNotes) {
      console.log(`- ${note.level}/${note.variant}: ${note.note}`);
    }
  }
}
