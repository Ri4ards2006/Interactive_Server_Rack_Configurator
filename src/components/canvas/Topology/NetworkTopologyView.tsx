/**
 * NetworkTopologyView.tsx
 *
 * Interactive 2D L2/L3 Datacenter Network Topology Graph View.
 * Renders hierarchical spine/leaf/compute/storage node maps,
 * active port links, link speed telemetry, and 802.1Q VLAN tags.
 */

import { useState, useMemo } from 'react';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import type { HardwareProps, CableProps, RackInstance } from '../../../types/rack.types';
import type { TopologyNode, TopologyLink } from '../../../types/network.types';
import { getChassisSlotRange } from '../../../utils/exporters/bomExporter';

export function NetworkTopologyView() {
  const racks = useConfiguratorStore((s) => s.racks);
  const activeRackId = useConfiguratorStore((s) => s.activeRackId);
  const cables = useConfiguratorStore((s) => s.cables);
  const selectedHardwareId = useConfiguratorStore((s) => s.selectedHardwareId);
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);
  const setViewMode = useConfiguratorStore((s) => s.setViewMode);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Extract topology nodes
  const nodes: TopologyNode[] = useMemo(() => {
    const list: TopologyNode[] = [];

    racks.forEach((rack) => {
      rack.installedHardware.forEach((h) => {
        if (h.type === 'blank' || h.type === 'brush' || h.type === 'cable-manager') {
          return; // Skip non-network passive baffles
        }

        const { slotRange, uStart } = getChassisSlotRange(h, rack.capacity);
        const net = h.networkConfig;
        const label = net?.hostname || h.modelName || `${h.type.toUpperCase()}-${slotRange}`;
        const managementIp = net?.managementIp ? `${net.managementIp}/${net.managementCidr || 24}` : 'DHCP / Unassigned';

        let tier: TopologyNode['tier'] = 'compute';
        if (h.type === 'switch' || h.type === 'router') tier = 'leaf';
        else if (h.type === 'jbod' || h.type === 'nas') tier = 'storage';
        else if (h.type === 'ups') tier = 'auxiliary';

        list.push({
          id: h.id,
          rackId: rack.id,
          rackName: rack.name,
          label,
          type: h.type,
          managementIp,
          uPosition: uStart,
          rackUnits: h.rackUnits,
          powerWatts: h.powerDraw,
          status: 'online',
          tier,
        });
      });
    });

    return list;
  }, [racks]);

  // Extract topology links from cables
  const links: TopologyLink[] = useMemo(() => {
    return cables.map((c) => {
      const fromNode = nodes.find((n) => n.id === c.fromDevice);
      const toNode = nodes.find((n) => n.id === c.toDevice);

      return {
        id: c.id,
        fromNodeId: c.fromDevice,
        fromPort: c.fromPort,
        toNodeId: c.toDevice,
        toPort: c.toPort,
        cableType: c.type || 'copper-cat6',
        speed: c.type?.includes('dac') ? '10G' : c.type?.includes('fiber') ? '25G/100G' : '1G/10G',
        vlanText: 'VLAN 10,20',
        status: c.hasBendViolation ? 'degraded' : 'active',
        color: c.color || '#06b6d4',
      };
    });
  }, [cables, nodes]);

  // Layout node coordinates by tier and index
  const nodePositions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    const tiers: Array<TopologyNode['tier']> = ['spine', 'leaf', 'compute', 'storage', 'auxiliary'];
    const tierY: Record<TopologyNode['tier'], number> = {
      spine: 80,
      leaf: 180,
      compute: 320,
      storage: 460,
      auxiliary: 580,
    };

    tiers.forEach((tier) => {
      const tierNodes = nodes.filter((n) => n.tier === tier);
      const count = tierNodes.length;
      if (count === 0) return;

      const spacing = Math.min(220, 900 / Math.max(1, count));
      const startX = 600 - ((count - 1) * spacing) / 2;

      tierNodes.forEach((node, idx) => {
        posMap.set(node.id, {
          x: startX + idx * spacing,
          y: tierY[tier],
        });
      });
    });

    return posMap;
  }, [nodes]);

  return (
    <div className="absolute inset-0 z-20 bg-zinc-950/95 flex flex-col font-mono text-zinc-200 select-none overflow-hidden">
      {/* Top Topology View Banner */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <div>
            <h2 className="text-xs font-bold tracking-widest text-zinc-100 uppercase">
              🌐 L2 / L3 DATACENTER NETWORK TOPOLOGY VIEW
            </h2>
            <span className="text-[9px] text-zinc-400">
              LOGICAL INTERFACE PATCHES, IP SCHEMAS & VLAN 802.1Q MAP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[9px] bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 text-zinc-400">
            TOTAL NODES: <span className="text-cyan-400 font-bold">{nodes.length}</span> | ACTIVE LINKS: <span className="text-emerald-400 font-bold">{links.length}</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('3D')}
            className="px-3 py-1.5 text-[10px] bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/80 text-cyan-300 rounded cursor-pointer transition-all active:scale-95"
          >
            [ EXIT TO 3D VIEW ]
          </button>
        </div>
      </div>

      {/* SVG Canvas Diagram */}
      <div className="flex-1 relative overflow-auto custom-scrollbar flex items-center justify-center p-6">
        <svg
          viewBox="0 0 1200 700"
          className="w-full max-w-6xl h-[650px] bg-zinc-900/40 rounded-xl border border-zinc-800/80 shadow-2xl"
        >
          <defs>
            <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Tier Background Grid Lines & Labels */}
          <g className="opacity-30">
            <line x1="80" y1="120" x2="1120" y2="120" stroke="#3f3f46" strokeDasharray="4,4" />
            <text x="90" y="115" fill="#a1a1aa" fontSize="10" fontWeight="bold">TIER 1: LEAF & TOR SWITCHING</text>

            <line x1="80" y1="280" x2="1120" y2="280" stroke="#3f3f46" strokeDasharray="4,4" />
            <text x="90" y="275" fill="#a1a1aa" fontSize="10" fontWeight="bold">TIER 2: COMPUTE & HYPERVISORS</text>

            <line x1="80" y1="440" x2="1120" y2="440" stroke="#3f3f46" strokeDasharray="4,4" />
            <text x="90" y="435" fill="#a1a1aa" fontSize="10" fontWeight="bold">TIER 3: STORAGE (JBOD / NAS)</text>

            <line x1="80" y1="580" x2="1120" y2="580" stroke="#3f3f46" strokeDasharray="4,4" />
            <text x="90" y="575" fill="#a1a1aa" fontSize="10" fontWeight="bold">TIER 4: AUXILIARY & POWER (UPS)</text>
          </g>

          {/* Links / Cables */}
          {links.map((link) => {
            const p1 = nodePositions.get(link.fromNodeId);
            const p2 = nodePositions.get(link.toNodeId);
            if (!p1 || !p2) return null;

            const isHighlighted =
              hoveredNodeId === link.fromNodeId ||
              hoveredNodeId === link.toNodeId ||
              selectedHardwareId === link.fromNodeId ||
              selectedHardwareId === link.toNodeId;

            // Curved cubic bezier connection
            const midY = (p1.y + p2.y) / 2;
            const pathD = `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;

            return (
              <g key={link.id} className="transition-all duration-200">
                <path
                  d={pathD}
                  fill="none"
                  stroke={link.color}
                  strokeWidth={isHighlighted ? 3.5 : 2}
                  strokeOpacity={isHighlighted ? 1 : 0.6}
                  strokeDasharray={link.status === 'degraded' ? '4,4' : undefined}
                  filter={isHighlighted ? 'url(#glow)' : undefined}
                />
                {/* Midpoint Speed Badge */}
                <rect
                  x={(p1.x + p2.x) / 2 - 22}
                  y={(p1.y + p2.y) / 2 - 8}
                  width="44"
                  height="16"
                  rx="3"
                  fill="#09090b"
                  stroke={link.color}
                  strokeWidth="1"
                />
                <text
                  x={(p1.x + p2.x) / 2}
                  y={(p1.y + p2.y) / 2 + 3}
                  textAnchor="middle"
                  fill="#f4f4f5"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {link.speed}
                </text>
              </g>
            );
          })}

          {/* Topology Nodes */}
          {nodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const isSelected = selectedHardwareId === node.id;
            const isHovered = hoveredNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - 75}, ${pos.y - 30})`}
                onClick={() => selectHardware(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="cursor-pointer transition-transform duration-150"
              >
                {/* Node Box */}
                <rect
                  width="150"
                  height="60"
                  rx="6"
                  fill={isSelected ? '#082f49' : isHovered ? '#1e293b' : '#09090b'}
                  stroke={
                    isSelected
                      ? '#38bdf8'
                      : node.tier === 'leaf'
                      ? '#06b6d4'
                      : node.tier === 'compute'
                      ? '#3b82f6'
                      : node.tier === 'storage'
                      ? '#a855f7'
                      : '#10b981'
                  }
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  filter={isSelected ? 'url(#glow)' : undefined}
                />

                {/* Status Dot */}
                <circle
                  cx="12"
                  cy="15"
                  r="4"
                  fill={node.status === 'online' ? '#10b981' : '#f59e0b'}
                />

                {/* Node Name */}
                <text
                  x="22"
                  y="18"
                  fill="#f4f4f5"
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  {node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}
                </text>

                {/* IP Badge */}
                <text x="12" y="34" fill="#38bdf8" fontSize="8">
                  IP: {node.managementIp}
                </text>

                {/* Rack & U slot badge */}
                <text x="12" y="48" fill="#71717a" fontSize="7.5">
                  {node.rackName} · U{node.uPosition} ({node.rackUnits}U) · {node.powerWatts}W
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
