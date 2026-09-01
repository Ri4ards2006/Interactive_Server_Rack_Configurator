<div align="center">

# 🛠️ Interactive 19″ Rack Lab Configurator & DCIM Simulator

**An enterprise-grade, web-native 3D engineering sandbox and DCIM simulation engine for designing, validating, and stress-testing EIA-310-D datacenter server-rack layouts — without touching real hardware.**

> Part of the **rz-cloud.work** ecosystem · Browser-only & Headless CLI · Zero backend required · Production telemetry-safe

[![license: ISC](https://img.shields.io/badge/license-ISC-22d3ee.svg)](#license)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](#tech-stack)
[![Three.js · R3F v9](https://img.shields.io/badge/Three.js-R3F%20v9-000000.svg)](#tech-stack)
[![Vite ESM](https://img.shields.io/badge/Vite-ESM-646cff.svg)](#tech-stack)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-CSS%20v4-38bdf8.svg)](#tech-stack)
[![Zustand v5](https://img.shields.io/badge/Zustand-v5-6366f1.svg)](#tech-stack)
[![Vitest 2](https://img.shields.io/badge/Vitest-2.x-6e9f18.svg)](#testing)
[![Version](https://img.shields.io/badge/version-v1.0.0-10b981.svg)](#version-100)

</div>

---

## ✨ Why this exists

Spreadsheets cannot model a 42U cabinet. Vendor PDFs cannot show you *what happens* when you stack a 4U server on top of a 1U switch, how phase currents imbalance across 3-phase PDU feeds, or how unblanked U-slots cause hot-air recirculation loops.

**Interactive Server Rack Configurator v1.0.0** bridges CAD visualization, electrical engineering math, thermal physics, DCIM API integration, and automated CI compliance into a single web-native platform.

The whole application runs client-side in your browser, with an optional zero-dependency headless CLI for CI/CD automation.

---

## 🎬 Core Capabilities & Features

| Feature | Description |
|---|---|
| 🌀 **Tri-Mode Rendering** | Seamlessly toggle between photoreal **`3D PBR`** (HDR reflections, contact shadows), CAD **`BLUEPRINT`** (flat fills, cyan-300 wireframes, U1..U42 rail labels), and **`THERMAL HEATMAP`** (ASHRAE inlet/exhaust faceplates & plume volumes). |
| 🧲 **Multi-Rack Baying** | Side-by-side multi-cabinet layouts (`Rack A`, `Rack B`, ...). Seamlessly add, rename, switch active bays, and route inter-rack patch cabling across bay boundaries ($X = \text{bayIndex} \times 0.65\,\text{m}$). |
| 🔌 **3D Cable Routing & Physics** | Interactive port-to-port patching (`Cat6`, `Cat6A`, `OM4 Multimode Fiber`, `OS2 Single-mode Fiber`, `10G DAC`). Simulates gravitational sag ($Y$-catenary curves) and detects bend radius violations against physical manufacturer tolerances. |
| ⚡ **3-Phase Electrical PDU Simulation** | Live RMS phase current balance ($I = \frac{P}{V \cdot \cos\varphi}$), IEEE/ANSI phase imbalance percentage, NEC 80% continuous safety thresholds, and A/B dual-corded outage failover testing across EU (230V/400V) and US (120V/208V) standards. |
| 🌡️ **ASHRAE Thermal & Airflow Engine** | Computes chassis temperature rise ($\Delta T = \frac{1.76 \times P}{\text{CFM}}$), total airflow requirements, and penalizes server inlet temps when open, unblanked U-slots create hot-air recirculation loops. Adjustable cold-aisle intake slider ($15^\circ\text{C}-32^\circ\text{C}$). |
| 💾 **Multi-Format Datacenter Exporters** | One-click downloads for structured datacenter **BOM JSON**, RFC-4180 **BOM CSV**, full 3D scene **Binary GLTF (.GLB)**, and publication-ready 2D vector **Rack Elevation SVG**. |
| 🌐 **NetBox DCIM REST API Sync** | Bidirectional synchronization with NetBox DCIM. Import rack elevations, hardware assets, and cable schedules directly into 3D, or push modifications back to NetBox with built-in offline mock demo fallback. |
| 🤖 **Headless CI Linter (`rack-lint`)** | Automated command-line compliance engine and GitHub Actions workflow (`.github/workflows/rack-compliance.yml`). Checks interval collisions, out-of-bounds, electrical overloads, cable bend violations, and Center-of-Gravity (CoG) tip-over stability. |
| 🧊 **Custom GLTF/GLB Vendor Asset Importer** | Drag-and-drop user-supplied 3D `.glb`/`.gltf` hardware vendor models into the catalog with automatic bounding-box calculation (`THREE.Box3`) and EIA-310-D 19-inch mounting fit. |
| ⏪ **Temporal Undo / Redo Stack** | Full state history undo/redo (`Ctrl+Z` / `Ctrl+Y`) powered by immutable snapshot tracking. |

---

## 🧱 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | React 19 · TypeScript 5.7+ (Strict Mode) | First-class JSX automatic runtime, strictly typed hardware and DCIM payload schemas. |
| **Build & Styling** | Vite 8 · Tailwind CSS v4 | Lightning-fast esbuild pipeline with zero-runtime utility styling. |
| **3D Rendering** | Three.js · `@react-three/fiber` v9 · `@react-three/drei` v10 | WebGL scene graph with custom PBR materials, procedural cables, and HDR environment maps. |
| **State Architecture** | Zustand v5 | Split state: **persistent** `useConfiguratorStore` for rack topologies and **transient** `useDragStore` for 60 Hz cursor drag snapping. |
| **Testing** | Vitest 2.1 | 296 unit tests covering layout invariants, electrical calculations, thermal physics, and linter rules. |
| **CI Automation** | Node.js CLI & GitHub Actions | Headless compliance verification without WebGL or browser DOM dependencies. |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js ≥ 20** (Vite 8 requires Node 20 LTS or newer)
- **npm ≥ 10**

### 1. Installation & Development Server
```bash
# Clone repository
git clone https://github.com/Ri4ards2006/Interactive_Server_Rack_Configurator.git
cd Interactive_Server_Rack_Configurator

# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev
```

### 2. Build & Preview
```bash
npm run build
npm run preview
```

### 3. Run Automated Tests
```bash
npm run test
# Runs 296 unit tests across 13 test suites with Vitest
```

### 4. Run Headless Rack Linter CLI
```bash
# Display help and rules
npm run rack-lint -- --help

# Lint a rack layout JSON or BOM file
node ./bin/rack-lint.js path/to/rack_layout.json
```

---

## 📐 Mathematical Invariants & Compliance Rules

### EIA-310-D Standard Mounting Spacing
- $1\text{U} = 1.75\,\text{inches} = 0.04445\,\text{meters}$
- Chassis width: $17.717\,\text{inches} = 0.45\,\text{meters}$
- Rail mounting width: $19.0\,\text{inches} = 0.4826\,\text{meters}$
- Parity-aware vertical snapping:
  $$y = \left(U_{\text{target}} - 1 + \frac{U_{\text{height}}}{2}\right) \times 0.04445\,\text{m}$$

### Electrical PDU Load Balancing
- RMS Phase Current:
  $$I_{\text{phase}} = \frac{P_{\text{phase}}}{V_{\text{phase}} \cdot \cos\varphi} \quad (\text{Nominal PF } \cos\varphi = 0.95)$$
- IEEE Phase Imbalance:
  $$\%_{\text{imbalance}} = \frac{I_{\max} - I_{\text{avg}}}{I_{\text{avg}}} \times 100$$
- NEC 80% Continuous Safety Threshold: $I_{\text{phase}} \le 0.80 \times I_{\text{breaker}}$

### ASHRAE Datacenter Thermal Model
- Chassis Temperature Differential:
  $$\Delta T = \frac{1.76 \times P_{\text{draw}}}{\text{CFM}} \quad (^\circ\text{C})$$
- Recirculation Bypass Penalty: Adjacent unblanked slots increase inlet temperature $T_{\text{inlet}} = T_{\text{ambient}} + \min(6.0, 1.5 \times \text{openSlots})$.

### Center-of-Gravity (CoG) Tip Stability
- Weighted CoG height:
  $$Y_{\text{CoG}} = \frac{\sum m_i \cdot y_i}{\sum m_i}$$
- Linter flags `WARN_TOP_HEAVY` if $Y_{\text{CoG}} > 0.55 \times H_{\text{rack}}$ or if heavy hardware (UPS $\ge 30\,\text{kg}$, JBOD $\ge 25\,\text{kg}$) is installed above U24.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
Part of the **rz-cloud.work** ecosystem.
