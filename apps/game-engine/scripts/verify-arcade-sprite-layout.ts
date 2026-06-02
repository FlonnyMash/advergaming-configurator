/**
 * Round-trip check for arcade body layout math.
 * Run: pnpm exec tsx scripts/verify-arcade-sprite-layout.ts
 */
import {
  computeArcadeBodyLayout,
  readFractionalHitboxFromBodyMetrics,
  type ApplyArcadeSpriteLayoutOptions,
} from "../src/game/arcadeSpriteLayoutMath.ts";

function approxEqual(a: number, b: number, epsilon = 1e-4): boolean {
  return Math.abs(a - b) <= epsilon;
}

function assertHitboxMatches(
  caseIndex: number,
  label: string,
  expected: Record<string, number | undefined>,
  actual: Record<string, number | undefined>,
): number {
  let failures = 0;
  for (const key of Object.keys(expected)) {
    const expectedValue = expected[key];
    if (expectedValue === undefined) {
      continue;
    }
    const actualValue = actual[key];
    if (!approxEqual(expectedValue, actualValue ?? NaN)) {
      console.error(
        `Case ${caseIndex} (${label}) hitbox.${key}:`,
        "expected",
        expectedValue,
        "got",
        actualValue,
      );
      failures += 1;
    }
  }
  return failures;
}

const cases: Array<{
  label: string;
  options: ApplyArcadeSpriteLayoutOptions;
  expectedHitbox: Record<string, number | undefined>;
}> = [
  {
    label: "centered shrink",
    options: {
      frameWidth: 64,
      frameHeight: 64,
      displayWidth: 48,
      layout: { hitbox: { width: 0.85, height: 0.85 } },
    },
    expectedHitbox: { width: 0.85, height: 0.85, offsetX: 0.075, offsetY: 0.075 },
  },
  {
    label: "explicit offsets",
    options: {
      frameWidth: 64,
      frameHeight: 64,
      displayWidth: 48,
      layout: {
        hitbox: { width: 0.5, height: 0.5, offsetX: 0.2, offsetY: 0.5 },
        centerOffset: { x: 0.01, y: -0.06 },
      },
    },
    expectedHitbox: {
      width: 0.5,
      height: 0.5,
      offsetX: 0.21,
      offsetY: 0.44,
    },
  },
];

let failed = 0;

for (const [index, testCase] of cases.entries()) {
  const { options, expectedHitbox, label } = testCase;
  const displayW = options.displayWidth ?? options.frameWidth;
  const displayH = (displayW / options.frameWidth) * options.frameHeight;

  const computed = computeArcadeBodyLayout(
    options,
    options.frameWidth,
    options.frameHeight,
    displayW,
    displayH,
  );

  if (!computed.hasCustomLayout) {
    console.error(`Case ${index} (${label}): expected custom layout`);
    failed += 1;
    continue;
  }

  const readBack = readFractionalHitboxFromBodyMetrics(
    computed.frameW,
    computed.frameH,
    computed.displayW,
    computed.displayH,
    computed.bodyW,
    computed.bodyH,
    computed.offsetFrameX,
    computed.offsetFrameY,
  );

  failed += assertHitboxMatches(index, label, expectedHitbox, readBack ?? {});
}

if (failed > 0) {
  console.error(`verify-arcade-sprite-layout: ${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("verify-arcade-sprite-layout: all cases passed");
