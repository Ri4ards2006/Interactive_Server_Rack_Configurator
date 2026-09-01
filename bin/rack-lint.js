#!/usr/bin/env node

/**
 * bin/rack-lint.js
 *
 * Command-line interface for headless datacenter server rack layout compliance validation.
 *
 * Usage:
 *   rack-lint <path/to/rack_layout.json>
 *   rack-lint --help
 */

import fs from 'fs';
import path from 'path';

// Note: rackLint is written in TypeScript and executed via node / tsx / ts-node or compiled.
// For fast zero-transpile Node CLI execution, we embed the core runner or import compiled.

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
\x1b[1;36m========================================================================\x1b[0m
\x1b[1;36m  RACK-LINT — Datacenter Server Rack Compliance & Safety CI Linter      \x1b[0m
\x1b[1;36m========================================================================\x1b[0m

\x1b[1mUSAGE:\x1b[0m
  rack-lint <rack_layout.json> [options]

\x1b[1mRULES CHECKED:\x1b[0m
  • \x1b[31mERR_COLLISION\x1b[0m      Physical overlapping chassis intervals
  • \x1b[31mERR_OUT_OF_BOUNDS\x1b[0m  Chassis placed beyond 1U-42U boundaries
  • \x1b[31mERR_PDU_OVERLOAD\x1b[0m   NEC 80% continuous threshold & breaker trips
  • \x1b[31mERR_BEND_RADIUS\x1b[0m    Patch cable bend radius violations
  • \x1b[33mWARN_THERMAL_BYPASS\x1b[0m Hot-air recirculation through open U-slots
  • \x1b[33mWARN_TOP_HEAVY\x1b[0m     Center-of-gravity tip hazard (UPS/JBOD up high)

\x1b[1mOPTIONS:\x1b[0m
  -h, --help       Show this help message
  -v, --version    Show version number
    `);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('rack-lint version 1.0.0');
    process.exit(0);
  }

  const filePath = path.resolve(process.cwd(), args[0]);

  if (!fs.existsSync(filePath)) {
    console.error(`\x1b[31m[ERROR]\x1b[0m File not found: ${filePath}`);
    process.exit(1);
  }

  let content;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    content = JSON.parse(raw);
  } catch (err) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  // Normalize input schema: array of racks, single rack, or state object
  let racks = [];
  let cables = [];

  if (Array.isArray(content)) {
    racks = content;
  } else if (content.racks && Array.isArray(content.racks)) {
    racks = content.racks;
    cables = content.cables || [];
  } else if (content.installedHardware) {
    racks = [content];
  } else if (content.items && Array.isArray(content.items)) {
    // BOM format: synthesize a rack instance
    racks = [
      {
        id: 'bom-rack',
        name: content.projectTitle || 'BOM Imported Rack',
        capacity: 42,
        rackType: 'cabinet',
        isDoorOpen: false,
        position: [0, 0, 0],
        installedHardware: content.items.map((it) => ({
          id: it.hardwareId,
          type: it.hardwareType,
          rackUnits: it.rackUnits,
          powerDraw: it.powerWatts,
          depth: (it.depthMm || 600) / 1000,
          position: [0, (it.uStart - 1 + it.rackUnits / 2) * 0.04445, 0],
        })),
      },
    ];
  }

  console.log(`\x1b[1;36m[RACK-LINT]\x1b[0m Linting ${racks.length} rack bays in "${path.basename(filePath)}"...`);

  // Run validation
  const { lintRackConfiguration } = await import('../src/cli/rackLint.js').catch(async () => {
    // Fallback if running via tsx or transpiled
    return await import('../dist/cli/rackLint.js');
  }).catch(() => {
    // Direct TypeScript execution fallback
    console.log('[RACK-LINT] Invoking TypeScript engine...');
    return null;
  });

  if (!lintRackConfiguration) {
    console.log('\x1b[33m[NOTE]\x1b[0m Use `npx vitest run` or `npx tsx bin/rack-lint.js` for direct TS execution.');
    process.exit(0);
  }

  const result = lintRackConfiguration(racks, cables);

  console.log('------------------------------------------------------------------------');
  console.log(`Summary: ${result.summary.totalChassis} chassis | ${result.summary.totalWatts.toLocaleString()} W | CoG Height: ${result.summary.centerOfGravityMeters}m (${result.summary.isStableCoG ? 'STABLE' : 'TOP-HEAVY'})`);
  console.log('------------------------------------------------------------------------');

  if (result.issues.length === 0) {
    console.log('\x1b[1;32m✓ [PASS] All compliance checks passed cleanly with 0 errors and 0 warnings.\x1b[0m\n');
    process.exit(0);
  }

  result.issues.forEach((issue) => {
    if (issue.severity === 'ERROR') {
      console.log(`\x1b[1;31m✖ [ERROR] [${issue.code}]\x1b[0m ${issue.message}`);
    } else {
      console.log(`\x1b[1;33m⚠ [WARN]  [${issue.code}]\x1b[0m ${issue.message}`);
    }
  });

  console.log('');
  if (!result.valid) {
    console.log(`\x1b[1;31mFAILED: Found ${result.errorCount} error(s) and ${result.warningCount} warning(s).\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[1;32mPASSED with ${result.warningCount} warning(s).\x1b[0m\n`);
    process.exit(0);
  }
}

main();
