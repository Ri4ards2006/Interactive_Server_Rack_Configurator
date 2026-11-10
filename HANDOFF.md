# HANDOFF — claude/configurator-v2 (2026-11-10)

## Done
- **Step 0:** `AUDIT.md` (stack, features, 8 verified bugs, UX/a11y, repo hygiene) + screenshots `docs/audit/desktop-1440.png`, `docs/audit/mobile-390.png`.
- **Task 1 (tests):** U-slot/rail helpers + 33 unit tests (`src/utils/__tests__/rackSlots.test.ts`); store fix: `addHardware` uses the lowest free gap and refuses when the rack is full (was stacking above U42), new validated `moveHardwareByUnits` with undo (9 tests). Vitest: 352/352 green (~2 s). Playwright e2e add/move/remove (`e2e/rack.e2e.ts`, desktop 1440 px) runs against `vite build && vite preview`. Under reduced motion the 3D scene renders on demand.
- `.gitignore` added (`node_modules/`, `dist/`, `test-results/`, `playwright-report/`). Tracked files are unchanged. Generated churn in `dist/` and `node_modules/` was reverted rather than committed.

## Not done
- Task 2: budget calculator (power W, BTU/h = W × 3.412, weight → TODO, U used/free). Also fix UPS `-1500 W` counting as negative load (AUDIT B2).
- Task 3: JSON save/load, front/rear printable SVG + PDF, BOM CSV (fix XML escaping B3, CSV formula injection B4).
- Task 4: validation warnings (PDU over-power, overweight, airflow mismatch).
- Task 5: keyboard/screen-reader basics and mobile layout. At 390 px the layout is currently unusable. The `mobile` Playwright project was removed until this is fixed.
- Task 6: CI (build/test/lint/e2e), untrack `node_modules/` + `dist/` (`git rm -r --cached`), README GIF placeholder, `docs/PORTFOLIO.md` EN+DE.

## Open questions for Richard
1. The PR targets `main`, but this branch was cut from `feat/phase5-live-telemetry-engine`, so the diff also contains the 5 unpushed phase-4/5 commits. Should the base be different, or should phase 4/5 be pushed/merged first?
2. Is it OK to untrack `node_modules/` (9 547 files) and `dist/` in Task 6?
3. Lint: should I add ESLint (+ typescript-eslint, react-hooks) as new devDependencies, or is `tsc --noEmit` enough?
4. Weight data: none of the catalogue entries has `weightKg`, and `rack-lint` guesses masses. Do you have vendor data, or should the overweight check stay TODO?
5. `<Environment preset="warehouse">` loads HDR from raw.githack/GitHub at runtime. Should it be self-hosted under `public/`?

## Known caveat
- E2E under software WebGL (SwiftShader, no GPU): shader compilation blocks the main thread for up to ~2.5 s (measured). That is why the timeouts are 15 s / 60 s, workers=2, and CI retries once. Locally there was about one flaky run in eight, then five green runs in a row.

## Next 3 steps
1. Task 2: `src/utils/rackBudget.ts` + tests (TDD), using catalogue data from `hardwareRegistry`. Treat UPS as a source and keep it out of the load totals. Show it in a new `BudgetPanel.tsx`; do not grow `ConfiguratorPanel.tsx` further.
2. Task 3: `layoutSerializer.ts` (versioned JSON, validated with `canPlaceAt`) + store `loadLayout`. Add `face: 'front' | 'rear'` and a light print theme to `generateRackElevationSVG`, plus a print window for PDF.
3. Task 5 before Task 4 if the demo matters: mobile drawer layout + aria labels, then re-enable the Playwright `mobile` project (Pixel 7).
