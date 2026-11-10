# AUDIT — Interactive Server Rack Configurator (v2 baseline)

Audit date: 2026-11-10 · Base commit: `dec9826` (branch `feat/phase5-live-telemetry-engine`, which contains `origin/main` + 5 unpushed commits) · Branch for this work: `claude/configurator-v2`.

## 1. Stack

| Layer | Technology (from `package.json`) |
|---|---|
| UI | React 19.2, Tailwind CSS 4.3 (`@tailwindcss/vite`) |
| 3D | three 0.185, `@react-three/fiber` 9.6, `@react-three/drei` 10.7 |
| State | Zustand 5 (`useConfiguratorStore` persistent + undo/redo, `useDragStore` transient) |
| Build | Vite 8.1 (Rolldown), TypeScript 7.0 (`tsc && vite build`) |
| Tests | Vitest 2.1 — 16 files / 310 tests, ~2 s wall clock (baseline, all green) |
| CLI | `bin/rack-lint.js` (headless linter) |
| CI | `.github/workflows/rack-compliance.yml`: `npm ci`, `tsc --noEmit`, `vitest run`, CLI `--help` |

Measured baseline: `npm test` 2.5 s, `npm run build` 2.3 s, bundle **1 549 kB JS (432 kB gzip) in one chunk**.

## 2. Features (as implemented)

- 3D rack (2-post / 4-post / cabinet), 12 built-in hardware types via a plugin registry (`src/utils/hardwareRegistry.ts`).
- Drag & snap to U slots with collision / bounds check (`src/utils/rackLayout.ts`, `src/hooks/`).
- Multi-rack baying, data hall planner, CRAC units, containment.
- Cable patching with bend-radius check, L2/L3 network config, topology view.
- 3-phase PDU simulation, A/B feed failover (`src/utils/electricalCalculations.ts`).
- Thermal / airflow estimation (`src/utils/thermalCalculations.ts`).
- Exports: BOM JSON/CSV, front elevation SVG, GLB.
- NetBox sync (mock mode by default), Prometheus/Zabbix telemetry (mock stream).
- Undo/redo (Ctrl+Z / Ctrl+Y).

## 3. Bugs (verified in code)

| # | Severity | Where | Bug |
|---|---|---|---|
| B1 | High | `useConfiguratorStore.addHardware` | New devices are always stacked on top of the highest device; **no capacity check** → adding to a full rack places hardware above U42. Free gaps below are ignored. |
| B2 | High | `bomExporter.generateBOMReport`, `ConfiguratorPanel` TOTAL_DRAW | UPS has `powerDraw = -1500` (source modelled as negative load). Totals **subtract** the UPS: a rack with a UPS reports less power and negative heat. |
| B3 | Medium | `elevationExporter` | Rack name / title interpolated into SVG without XML escaping (`&`, `<` produce an invalid SVG). UPS rendered as "PASSIVE" (negative power). |
| B4 | Medium | `bomExporter.escapeCSV` | No protection against CSV formula injection (`=`, `+`, `-`, `@` prefixed rack names are executed by Excel/LibreOffice). |
| B5 | Medium | `src/cli/rackLint.ts` | Centre-of-gravity check uses **guessed** per-type masses (`18 kg/U` UPS etc.). Catalogue field `weightKg` exists in `plugin.types.ts` but no built-in plugin sets it. |
| B6 | Low | `updateHardwarePosition` | Store accepts any position (no validation); only callers validate. |
| B7 | Low | Elevation export | Front view only, dark background (not printable), no rear view, no PDF path. |
| B8 | Low | Save/Load | No way to save or reload a layout (JSON) — state is lost on reload. |

## 4. UX problems (screenshots in `docs/audit/`)

| Viewport | Screenshot | Findings |
|---|---|---|
| 1440 px | `docs/audit/desktop-1440.png` | Two 320 px sidebars + floating HUD; usable. In headless Chromium (SwiftShader) the 3D viewport stayed black at this size — WebGL-dependent, not reproducible as a code bug without a GPU. No visible power/heat/weight budget besides TOTAL_DRAW; no validation warnings beyond thermal recirculation. |
| 390 px | `docs/audit/mobile-390.png` | **Broken**: both fixed `w-80` sidebars and the centred HUD overlap each other and the 3D view; text unreadable; no way to reach the canvas. No horizontal scroll, but the layout is unusable. |

Accessibility: **0** `aria-*` / `role` attributes in `src/components`. Icon-only buttons (`[X]`, colour swatches) have no accessible names; inventory rows are clickable `<div>`s (not keyboard-focusable); modals lack `role="dialog"`; `focus:outline-none` removes focus rings; no keyboard way to move a device except selecting it with the mouse first.

## 5. Repo hygiene

- `node_modules/` (9 547 files) and `dist/` are **committed**; there is no `.gitignore`. Running the tests dirties the tree (`node_modules/.vite/vitest/results.json`).
- CI has no build step and no lint; workflow only triggers PRs against `main`.
- `ConfiguratorPanel.tsx` is a 2 398-line monolith.
- README says "TypeScript 5.7+"; the project uses TypeScript 7.

## 6. Plan (this branch)

1. Tests: rail/U-slot helpers + first-free-slot placement (fixes B1), Playwright e2e add/move/remove.
2. Budget calculator from the catalogue (power, BTU/h = W × 3.412, weight → TODO when missing, U used/free) — fixes B2.
3. Export: JSON save/load, front+rear printable SVG + print-to-PDF, BOM CSV with catalogue columns — fixes B3, B4, B7, B8.
4. Validation warnings: PDU over-power, overweight (only when data exists), airflow mismatch.
5. Keyboard + screen-reader basics, mobile layout.
6. CI (build/test/lint/e2e), `.gitignore` + untrack `node_modules`/`dist`, README + `docs/PORTFOLIO.md` (EN+DE).
