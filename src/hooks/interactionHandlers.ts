/**
 * interactionHandlers.ts
 *
 * Pure-ish drag-event handlers extracted from `useHardwareInteraction.ts`.
 *
 * Each handler takes a richly-typed `DragInteractionContext` that
 * carries the hardware identity, the local React state, the captured
 * pointerId ref, and a bundle of store actions. Callbacks receive the
 * R3F event via the `e` parameter, and store actions are invoked
 * through the ctx — never via direct store imports.
 *
 * Why pass actions instead of importing stores directly?
 *   - Trivial to swap in a mock for unit testing without spinning up
 *     Zustand (no `vi.mock(...).getState` plumbing).
 *   - Decouples the handler module from the Zustand-vendored
 *     TypeScript signatures — cheaper to refactor when the store
 *     surface changes.
 *   - Makes the data flow visible at the callsite: the hook builder
 *     assembles `ctx` explicitly; no implicit global state.
 *
 * Pointer-capture mechanics rely on the module-private `asElement`
 * helper that narrows `ThreeEvent.target` from the structural
 * `EventTarget | null` (forced by R3F v9's `IntersectionEvent<T> &
 * Properties<T>`) back to `Element`. The handler module owns this
 * helper because it's an implementation detail of the pointer-capture
 * pattern, not a general-purpose utility. Promote to `src/utils/dom`
 * if a second module ever needs it.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { HardwareProps, Vec3 } from '../types/rack.types';
import { snapToU } from './snapToU';
import { checkDropValidity } from '../utils/rackLayout';

/**
 * Narrow an R3F v9 `ThreeEvent.target` from the structural
 * `EventTarget | null` (forced by `IntersectionEvent<T> & Properties<T>`
 * inheriting PointerEvent's own typing) back down to `Element` so
 * callers can invoke pointer-capture methods without per-callsite
 * `as` casts.
 *
 * Runtime guard: if the target somehow isn't an `Element` (rare
 * upstream regression or future R3F refactor), returns `null` instead
 * of throwing. Callers use optional chaining (`?.`) to skip the
 * capture operation gracefully — the drag's local React state and
 * dragstore are torn down regardless by the caller, so a missed
 * capture is benign.
 *
 * Defined once at module scope. ~ns runtime cost via a single
 * `instanceof` check at the call site; no heap allocations per drag
 * tick.
 */
function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

/** Snapshot the transient dragstore keeps of the active drag target. */
interface DragSnapshot {
  id: string;
  rackUnits: number;
  depth: number;
}

/**
 * Snapshot of the persistent configurator store, returned by
 * `readPersistentState()` so `handlePointerMove` always sees the
 * latest installed hardware + capacity without entangling the ctx
 * with mutable fields that would freeze on first render.
 */
interface PersistentStateSnapshot {
  capacity: number;
  installedHardware: HardwareProps[];
}

/**
 * Everything a drag handler needs to read or mutate, assembled once
 * per render by `useHardwareInteraction` and captured by closure by
 * each handler. Flat shape — every field is a single primitive or
 * function, so the signature stays greppable.
 */
export interface DragInteractionContext {
  /** The hardware being interacted with. Identity-keyed. */
  hardware: HardwareProps;
  /** True while this hardware is being dragged (read by move handler). */
  isDragging: boolean;
  /** Local React setter; written by down/up handlers. */
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  /** Mutable ref tracking the captured pointerId (null when not active). */
  capturedPointerIdRef: MutableRefObject<number | null>;

  // ----- Persistent-configurator actions (mutating) -----
  /** Select this hardware in the configurator store. */
  selectHardware: (id: string) => void;
  /** Write a new world position for this chassis. */
  updateHardwarePosition: (id: string, nextPosition: Vec3) => void;
  /** Read the latest persistent-state snapshot at call time. */
  readPersistentState: () => PersistentStateSnapshot;

  // ----- Transient dragstore actions (mutating) -----
  beginDrag: (snapshot: DragSnapshot) => void;
  updateDropPosition: (nextPosition: Vec3, isValid: boolean) => void;
  endDrag: () => void;
}

/**
 * Begin a drag on this hardware:
 *   1. Mark this hardware as selected + publish a drag snapshot to
 *      the transient dragstore.
 *   2. Set local `isDragging=true` so `useCursor` flips to grabbing
 *      and the move handler becomes active.
 *   3. Capture the pointer on the canvas (via R3F v9's `e.target`)
 *      so drag events keep firing even when the cursor leaves the
 *      chassis mesh.
 *   4. Stash the pointerId in the ref so the window-fallback can
 *      release capture in degenerate teardown paths.
 */
export function handlePointerDown(
  e: ThreeEvent<PointerEvent>,
  ctx: DragInteractionContext,
): void {
  e.stopPropagation();
  ctx.selectHardware(ctx.hardware.id);
  ctx.beginDrag({
    id: ctx.hardware.id,
    rackUnits: ctx.hardware.rackUnits,
    depth: ctx.hardware.depth,
  });
  ctx.setIsDragging(true);
  // Narrowed through `asElement` (see top-of-file for why TS sees
  // `EventTarget | null` despite R3F v9's docs).
  asElement(e.target)?.setPointerCapture(e.pointerId);
  ctx.capturedPointerIdRef.current = e.pointerId;
}

/**
 * Snap the chassis to the cursor's snapped-Y and write the result
 * to BOTH the persistent store (so this chassis moves on-screen) AND
 * the transient dragstore (so `DropIndicator` can recolor its ghost).
 *
 * Bails silently if this chassis is not the active drag target.
 */
export function handlePointerMove(
  e: ThreeEvent<PointerEvent>,
  ctx: DragInteractionContext,
): void {
  if (!ctx.isDragging) return;
  e.stopPropagation();

  // `rackUnits` is passed in so `snapToU` knows whether to land on a
  // slot centre (odd) or a slot seam (even).
  const snappedY = snapToU(e.point.y, ctx.hardware.rackUnits);

  // Fresh snapshot of the persistent store so this single move-tick
  // sees a consistent (capacity, installedHardware) pair — using
  // multiple `getState()` reads in succession would risk drift if
  // another writer touched the store between calls.
  const persistent = ctx.readPersistentState();
  const current = persistent.installedHardware.find(
    (h) => h.id === ctx.hardware.id,
  );
  const x = current?.position[0] ?? ctx.hardware.position[0];
  const z = current?.position[2] ?? ctx.hardware.position[2];
  const nextPosition: Vec3 = [x, snappedY, z];

  // Collision + bounds check against the canonical rack state.
  // Result feeds the transient dragstore so DropIndicator can recolor
  // its ghost without coupling to this component's local React state.
  const isValid = checkDropValidity(
    ctx.hardware.id,
    snappedY,
    ctx.hardware.rackUnits,
    persistent.capacity,
    persistent.installedHardware,
  );

  // Commit to persistent store (drives this chassis' render so it
  // tracks the cursor even when the ghost is "invalid" — the ghost
  // is purely a visual cue and should not steal control of where
  // the chassis sits).
  ctx.updateHardwarePosition(ctx.hardware.id, nextPosition);
  // Mirror to transient dragstore with the validity result.
  ctx.updateDropPosition(nextPosition, isValid);
}

/**
 * End the drag:
 *   1. Clear local `isDragging=false` so `useCursor` returns to grab.
 *   2. Notify the transient dragstore (clears the ghost).
 *   3. Explicitly release the captured pointer on the canvas (if
 *      this pointer is still bound) — the browser usually auto-
 *      releases on pointerup, but the explicit call is cheap and
 *      documents intent.
 *   4. Clear the capturedPointerIdRef so the window-fallback sees a
 *      null ref on its next tick.
 */
export function handlePointerUp(
  e: ThreeEvent<PointerEvent>,
  ctx: DragInteractionContext,
): void {
  e.stopPropagation();
  ctx.setIsDragging(false);
  ctx.endDrag();
  const targetEl = asElement(e.target);
  if (targetEl?.hasPointerCapture(e.pointerId)) {
    targetEl.releasePointerCapture(e.pointerId);
  }
  ctx.capturedPointerIdRef.current = null;
}
