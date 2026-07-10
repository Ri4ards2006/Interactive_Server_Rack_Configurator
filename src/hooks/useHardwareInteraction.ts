/**
 * useHardwareInteraction.ts
 *
 * React-orchestration layer for a piece of rack hardware's pointer
 * interactions. The dense drag-event logic (capture, snap, collision,
 * release) lives in `./interactionHandlers.ts` as pure-ish functions
 * of `(ThreeEvent, DragInteractionContext)`. This hook assembles
 * that context from local React state + refs + store actions and
 * returns the 6 spreadable handlers R3F's `<group>` expects.
 *
 * What stays here vs what moved out:
 *   - HERE: React pieces (`useState`, `useEffect`, `useRef`, `useCursor`),
 *     the Zustand selection selector, the window-fallback cleanup
 *     arrow (carries its own capture-release path because it receives
 *     naked window events without a ThreeEvent target), and the tiny
 *     hover handlers (over/out are 1-line toggles).
 *   - OUT (in interactionHandlers): drag handlers (down/move/up),
 *     the `asElement` runtime type-narrowing helper, the snapshot
 *     types `DragSnapshot` / `PersistentStateSnapshot`, and the
 *     `DragInteractionContext` interface.
 *
 * Behavior is byte-equivalent to the prior inline implementation —
 * the refactor just removes duplicated boilerplate from the four
 * chassis components (`Server.tsx`, `Switch.tsx`, `Router.tsx`,
 * `PatchPanel.tsx`).
 *
 * Usage from a chassis component:
 *
 *   const { isSelected, ...handlers } = useHardwareInteraction(hardware);
 *   return <group {...handlers} position={...}>...</group>;
 */

import { useEffect, useRef, useState } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { useConfiguratorStore } from '../store/useConfiguratorStore';
import { useDragStore } from '../store/useDragStore';
import type { HardwareProps } from '../types/rack.types';
import {
  DragInteractionContext,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
} from './interactionHandlers';

export interface HardwareInteraction {
  /** True while the pointer is over this chassis. */
  isHovered: boolean;
  /** True while this hardware is the currently selected item. */
  isSelected: boolean;
  /** True while this hardware is being dragged. */
  isDragging: boolean;
  /** R3F event handlers — spread onto a `<group>` to wire interactions. */
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerCancel: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Pointer-capture mechanics
 * -------------------------
 * R3F v9 exposes the underlying DOM `Element` as `e.target` on every
 * `ThreeEvent`. The drag handlers call `e.target.setPointerCapture` /
 * `releasePointerCapture` / `hasPointerCapture` via the
 * `asElement` runtime-narrowing helper in `interactionHandlers`.
 * Older R3F versions (<v9) exposed `e.target` as a `THREE.Object3D`
 * and required `gl.domElement.setPointerCapture` — the codebase
 * predates v9 and the prior approach is documented in git history.
 */
export function useHardwareInteraction(
  hardware: HardwareProps,
): HardwareInteraction {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Tracks the pointerId of the most recent `setPointerCapture` call.
   * Read by the window-fallback cleanup arrow below to release any
   * capture that wasn't auto-released by the browser (e.g. when
   * `blur` fires before any `pointerup`).
   */
  const capturedPointerIdRef = useRef<number | null>(null);

  // Tight Zustand selector: this chassis re-renders ONLY when its
  // own `selectedHardwareId` flips, not on every selection change.
  const isSelected = useConfiguratorStore(
    (s) => s.selectedHardwareId === hardware.id,
  );

  // Cursor feedback: drei's `useCursor` writes `grab` / `grabbing` /
  // reset to the canvas via R3F context — no second arg needed.
  const cursorActive = isHovered || isDragging;
  const cursorStyle: 'grab' | 'grabbing' | 'auto' = isDragging
    ? 'grabbing'
    : isHovered
      ? 'grab'
      : 'auto';
  useCursor(cursorActive, cursorStyle);

  /**
   * Belt-and-braces drag release. If the cursor leaves the chassis
   * mid-drag, R3F's `onPointerUp` no longer fires (raycaster misses)
   * and the drag state could stay `true` forever. We side-channel
   * via `window.addEventListener` for `pointerup`, `pointercancel`,
   * and `blur` to force a clean teardown regardless of where the
   * pointer ends up.
   *
   * Why does this cleanup arrow stay local (vs being moved to
   * `interactionHandlers` alongside the other handlers)? Because the
   * window events arrive WITHOUT a ThreeEvent target — `e.target` on
   * a naked DOM `PointerEvent` from `window` may be any element, and
   * the canvas's `releasePointerCapture` is what we actually need.
   * Synthesizing a ThreeEvent to feed through `handlePointerUp`
   * would be over-engineered and would re-introduce the multi-
   * canvas `querySelector('canvas')` ambiguity upstream called out
   * below. So this arrow keeps its own minimal capture-release path.
   */
  useEffect(() => {
    if (!isDragging) return;
    const endDrag = () => {
      setIsDragging(false);
      useDragStore.getState().endDrag();
      // Defensive: if a captured pointer is still live on the canvas
      // (blur fired before pointerup, or the user dragged off the
      // page and the browser didn't auto-release), force-release it
      // so the cursor isn't locked. Browser auto-release is the
      // primary path; this is the explicit "if not, do it now" path.
      if (capturedPointerIdRef.current != null) {
        const canvas = document.querySelector('canvas');
        canvas?.releasePointerCapture(capturedPointerIdRef.current);
        capturedPointerIdRef.current = null;
      }
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('blur', endDrag);
    };
  }, [isDragging]);

  /**
   * Per-render drag-handler context. Stable references (`setIsDragging`,
   * `capturedPointerIdRef`, store actions) are read once here; volatile
   * values (`isDragging`, `hardware`) are passed fresh each call.
   *
   * `readPersistentState` is a closure over `useConfiguratorStore`
   * that returns a fresh snapshot on every call. That's required
   * because `handlePointerMove` reads installedHardware once per
   * pointermove tick — snapshotting it at render-time would freeze
   * the installedHardware list if a sibling chassis gets removed
   * mid-drag.
   */
  const ctx: DragInteractionContext = {
    hardware,
    isDragging,
    setIsDragging,
    capturedPointerIdRef,
    selectHardware: useConfiguratorStore.getState().selectHardware,
    updateHardwarePosition:
      useConfiguratorStore.getState().updateHardwarePosition,
    readPersistentState: () => {
      const s = useConfiguratorStore.getState();
      return { capacity: s.capacity, installedHardware: s.installedHardware };
    },
    beginDrag: useDragStore.getState().beginDrag,
    updateDropPosition: useDragStore.getState().updateDropPosition,
    endDrag: useDragStore.getState().endDrag,
  };

  return {
    isHovered,
    isSelected,
    isDragging,

    // Hover toggles stay inline: they're 1-line state flips with no
    // shared logic worth extracting.
    onPointerOver(e) {
      e.stopPropagation();
      setIsHovered(true);
    },

    onPointerOut(e) {
      e.stopPropagation();
      setIsHovered(false);
    },

    // Drag handlers delegate to the extracted pure-ish functions.
    // Each wrapper is a thin closure that captures the current `ctx`.
    onPointerDown: (e) => handlePointerDown(e, ctx),
    onPointerMove: (e) => handlePointerMove(e, ctx),
    onPointerUp: (e) => handlePointerUp(e, ctx),

    // `pointercancel` is semantically identical to `pointerup` for
    // our purposes — a cancelled drag (e.g. browser scrollbar grab,
    // OS-level pointer handoff) still cleanly tears down capture
    // + dragstore via the same path.
    onPointerCancel: (e) => handlePointerUp(e, ctx),
  };
}
