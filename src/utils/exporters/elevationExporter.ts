/**
 * elevationExporter.ts
 *
 * 2D Vector Rack Elevation Drawing generator.
 * Produces crisp, publication-quality EIA-310-D rack elevation SVG drawings
 * with mounting rails, U-numbers, title blocks, and chassis power tags.
 */

import type { RackInstance } from '../../types/rack.types';
import { getChassisSlotRange, WATTS_TO_BTU_PER_HOUR, downloadFile } from './bomExporter';

const HARDWARE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  server: { fill: '#1e293b', stroke: '#38bdf8', text: '#e2e8f0' },
  switch: { fill: '#0f172a', stroke: '#10b981', text: '#ecfdf5' },
  router: { fill: '#0f172a', stroke: '#06b6d4', text: '#ecfeff' },
  firewall: { fill: '#3b0764', stroke: '#c084fc', text: '#faf5ff' },
  pdu: { fill: '#451a03', stroke: '#f59e0b', text: '#fffbeb' },
  ups: { fill: '#1c1917', stroke: '#f97316', text: '#fff7ed' },
  nas: { fill: '#18181b', stroke: '#6366f1', text: '#eef2ff' },
  jbod: { fill: '#18181b', stroke: '#818cf8', text: '#eef2ff' },
  kvm: { fill: '#27272a', stroke: '#a1a1aa', text: '#f4f4f5' },
  blank: { fill: '#09090b', stroke: '#27272a', text: '#71717a' },
  brush: { fill: '#09090b', stroke: '#3f3f46', text: '#71717a' },
  'cable-manager': { fill: '#18181b', stroke: '#52525b', text: '#a1a1aa' },
};

/**
 * Generates standalone, scalable 2D vector SVG elevation drawing of a rack.
 */
export function generateRackElevationSVG(
  rack: RackInstance,
  options: { title?: string; includeTitleBlock?: boolean } = {},
): string {
  const capacity = rack.capacity || 42;
  const title = options.title || rack.name;
  const includeTitleBlock = options.includeTitleBlock ?? true;

  // Geometry dimensions (in SVG coordinate pixels)
  const uHeightPx = 24; // 24px per 1.75 inch U
  const rackInnerWidth = 360; // 19-inch mounting width
  const railWidth = 36;
  const leftMargin = 80;
  const rightMargin = 80;
  const topMargin = includeTitleBlock ? 140 : 40;
  const bottomMargin = 60;

  const rackTotalWidth = railWidth * 2 + rackInnerWidth;
  const rackTotalHeight = capacity * uHeightPx;
  const svgWidth = leftMargin + rackTotalWidth + rightMargin;
  const svgHeight = topMargin + rackTotalHeight + bottomMargin;

  const totalPower = rack.installedHardware.reduce((sum, h) => sum + h.powerDraw, 0);
  const totalHeatBTU = Math.round(totalPower * WATTS_TO_BTU_PER_HOUR);

  const svgParts: string[] = [];

  // SVG Opening
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="background-color: #09090b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">`,
  );

  // Definitions (Gradients & Filters)
  svgParts.push(`
    <defs>
      <linearGradient id="railGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#27272a" />
        <stop offset="50%" stop-color="#3f3f46" />
        <stop offset="100%" stop-color="#18181b" />
      </linearGradient>
      <pattern id="holePattern" width="12" height="8" patternUnits="userSpaceOnUse">
        <rect x="3" y="2" width="4" height="4" rx="1" fill="#09090b" stroke="#52525b" stroke-width="0.5" />
      </pattern>
    </defs>
  `);

  // Title Block
  if (includeTitleBlock) {
    svgParts.push(`
      <g id="title-block">
        <rect x="${leftMargin}" y="20" width="${rackTotalWidth}" height="100" rx="4" fill="#18181b" stroke="#27272a" stroke-width="1" />
        <text x="${leftMargin + 16}" y="48" fill="#f4f4f5" font-size="16" font-weight="bold" letter-spacing="1.5">${title.toUpperCase()} — 2D ELEVATION</text>
        <text x="${leftMargin + 16}" y="70" fill="#a1a1aa" font-size="10">TYPE: ${rack.rackType.toUpperCase()} | CAPACITY: ${capacity}U | HARDWARE COUNT: ${rack.installedHardware.length}</text>
        <text x="${leftMargin + 16}" y="88" fill="#38bdf8" font-size="10">TOTAL POWER: ${totalPower.toLocaleString()} W | HEAT DISSIPATION: ${totalHeatBTU.toLocaleString()} BTU/hr</text>
        <text x="${leftMargin + 16}" y="106" fill="#71717a" font-size="9">GENERATED: ${new Date().toLocaleString()}</text>
      </g>
    `);
  }

  const rackX = leftMargin;
  const rackY = topMargin;

  // Outer Rack Frame Border
  svgParts.push(`
    <rect x="${rackX}" y="${rackY}" width="${rackTotalWidth}" height="${rackTotalHeight}" fill="#09090b" stroke="#3f3f46" stroke-width="2" />
  `);

  // Left Rail
  svgParts.push(`
    <rect x="${rackX}" y="${rackY}" width="${railWidth}" height="${rackTotalHeight}" fill="url(#railGrad)" stroke="#52525b" stroke-width="1" />
    <rect x="${rackX + 12}" y="${rackY}" width="${railWidth - 24}" height="${rackTotalHeight}" fill="url(#holePattern)" />
  `);

  // Right Rail
  svgParts.push(`
    <rect x="${rackX + railWidth + rackInnerWidth}" y="${rackY}" width="${railWidth}" height="${rackTotalHeight}" fill="url(#railGrad)" stroke="#52525b" stroke-width="1" />
    <rect x="${rackX + railWidth + rackInnerWidth + 12}" y="${rackY}" width="${railWidth - 24}" height="${rackTotalHeight}" fill="url(#holePattern)" />
  `);

  // U Markers & Dividing Grid Lines
  for (let u = 1; u <= capacity; u++) {
    // In elevation drawings, U42 is at the top, U1 is at the bottom
    const uIndexFromTop = capacity - u;
    const y = rackY + uIndexFromTop * uHeightPx;

    // Horizontal U-separator line
    svgParts.push(`
      <line x1="${rackX}" y1="${y}" x2="${rackX + rackTotalWidth}" y2="${y}" stroke="#27272a" stroke-width="0.75" stroke-dasharray="2,2" />
    `);

    // Left U Number label
    svgParts.push(`
      <text x="${rackX - 12}" y="${y + uHeightPx / 2 + 3.5}" fill="#71717a" font-size="9" text-anchor="end" font-weight="bold">${u}</text>
    `);

    // Right U Number label
    svgParts.push(`
      <text x="${rackX + rackTotalWidth + 12}" y="${y + uHeightPx / 2 + 3.5}" fill="#71717a" font-size="9" text-anchor="start" font-weight="bold">${u}</text>
    `);
  }

  // Draw Installed Hardware Units
  const innerX = rackX + railWidth;

  rack.installedHardware.forEach((h) => {
    const { slotRange, uStart, uEnd } = getChassisSlotRange(h, capacity);
    const uUnits = h.rackUnits;
    const uIndexFromTop = capacity - uEnd;
    const chassisY = rackY + uIndexFromTop * uHeightPx;
    const chassisHeight = uUnits * uHeightPx;

    const colors = HARDWARE_COLORS[h.type] || {
      fill: '#1e293b',
      stroke: '#38bdf8',
      text: '#f8fafc',
    };

    // Chassis Box
    svgParts.push(`
      <g id="chassis-${h.id}">
        <rect x="${innerX + 1}" y="${chassisY + 1}" width="${rackInnerWidth - 2}" height="${chassisHeight - 2}" rx="2" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5" />
        
        <!-- Bezel accent bar -->
        <rect x="${innerX + 4}" y="${chassisY + 3}" width="4" height="${chassisHeight - 6}" rx="1" fill="${colors.stroke}" />
        
        <!-- Text details -->
        <text x="${innerX + 16}" y="${chassisY + Math.min(16, chassisHeight / 2 + 4)}" fill="${colors.text}" font-size="11" font-weight="bold">
          ${h.type.toUpperCase()} <tspan fill="#94a3b8" font-size="9" font-weight="normal">[${slotRange} • ${h.rackUnits}U]</tspan>
        </text>
        
        ${
          chassisHeight >= 36
            ? `<text x="${innerX + 16}" y="${chassisY + chassisHeight - 8}" fill="${colors.stroke}" font-size="9">
                ${h.powerDraw > 0 ? `${h.powerDraw}W` : 'PASSIVE'} • ${Math.round(h.depth * 1000)}mm DEPTH
               </text>`
            : ''
        }
      </g>
    `);
  });

  // Footer Dimension Marks
  svgParts.push(`
    <g id="footer-dimensions">
      <line x1="${rackX}" y1="${rackY + rackTotalHeight + 16}" x2="${rackX + rackTotalWidth}" y2="${rackY + rackTotalHeight + 16}" stroke="#52525b" stroke-width="1" />
      <text x="${rackX + rackTotalWidth / 2}" y="${rackY + rackTotalHeight + 32}" fill="#a1a1aa" font-size="10" text-anchor="middle">19" EIA-310-D STANDARD MOUNTING (482.6 mm)</text>
    </g>
  `);

  svgParts.push('</svg>');

  return svgParts.join('\n');
}

/**
 * Browser helper to export and trigger download of the SVG Elevation drawing.
 */
export function exportRackElevationSVG(
  rack: RackInstance,
  filename: string = 'rack_elevation_drawing.svg',
): void {
  const svgContent = generateRackElevationSVG(rack);
  downloadFile(filename, svgContent, 'image/svg+xml;charset=utf-8');
}
