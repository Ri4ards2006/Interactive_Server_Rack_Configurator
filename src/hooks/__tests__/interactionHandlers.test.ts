/**
 * interactionHandlers.test.ts
 *
 * Unit tests for the extracted drag handlers in
 * `src/hooks/interactionHandlers.ts`.
 *
 * Goals
 * -----
 * 1. Validate every documented behaviour of `handlePointerDown`,
 *    `handlePointerMove`, and `handlePointerUp` — including the
 *    graceful "non-Element target" path that the `asElement` helper
 *    encodes.
 * 2. Confirm the `DragInteractionContext` API is wired correctly:
 *    every action the handlers invoke reaches the store-action ref
 *    passed in via `ctx`, with the correct argument shape.
 * 3. Run fast in pure-Node Vitest — no React mount, no Zustand
 *    store, no canvas / WebGL. Total runtime typically well under
 *    50ms.
 *
 * Strategy
 * --------
 * - `globalThis.Element` is replaced with a `StubElement` class
 *    whose capture-related methods are `vi.fn()` spies. The class
 *    also implements the full EventTarget interface (addEventListener,
 *    removeEventListener, dispatchEvent) so narrowed `EventTarget`
 *    assignments typecheck without jsdom / happy-dom.
 *
 * - `makeEvent(...)` factory produces a synthetic `ThreeEvent<
 *    PointerEvent>` carrying only the fields the handlers read
 *    (`target`, `pointerId`, `point.y`, `stopPropagation`),
 *    cast through `unknown` because R3F's full type requires
 *    fields (intersections, ray, camera) that aren't relevant
 *    to a command-pattern test.
 *
 * - `makeCtx(overrides)` returns a fully-typed `DragInteractionContext`
 *    with vi.fn() spies on every callable. `mockOf(fn)` casts a
 *    callable back to a mock so `.mock.calls[N][M]` introspection
 *    can access individual arguments.
 *
 * Matcher caveat
 * --------------
 * The matcher `toHaveBeenCalledOnceWith` is NOT shipped in Vitest
 * 2.1.x (verified empirically — see the developer-note thread). The
 * idiomatic equivalent is two assertions:
 *
 *     expect(spy).toHaveBeenCalledTimes(1);
 *     expect(spy).toHaveBeenCalledWith(...args);
 *
 * or the equivalent `.mock.calls` form:
 *
 *     expect(spy.mock.calls).toEqual([[...args]]);
 *
 * We use the two-assertion form throughout for fail-fast granularity.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { ThreeEvent } from '@react-three/fiber';
import type { HardwareProps } from '../../types/rack.types';
import { RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';
import {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  type DragInteractionContext,
} from '../interactionHandlers';

const U = RACK_UNIT_HEIGHT;
const CAPACITY = 42;

// ---------------------------------------------------------------------------
// Stub Element. Implements the whole EventTarget interface so narrowed
// `EventTarget` assignments typecheck; capture methods are vi.fn() spies.
// ---------------------------------------------------------------------------

class StubElement {
  setPointerCapture = vi.fn();
  releasePointerCapture = vi.fn();
  hasPointerCapture = vi.fn<(pointerId: number) => boolean>(() => false);
  // EventTarget parent-class requirements (TS narrows addEventListener
  // signature from the surrounding EventTarget typing).
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
}

beforeAll(() => {
  // Vitest's default Node environment doesn't define `Element`. The
  // handlers' `target instanceof Element` check would throw. Install
  // a minimal Element substitute on globalThis so instanceof works.
  (globalThis as unknown as { Element: typeof Element }).Element =
    StubElement as unknown as typeof Element;
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

/**
 * Cast a ctx callable (typed as a plain function in the interface) back
 * to its vi.fn() shape so `.mock.calls[N][M]` introspection works.
 *
 * We use `any` here (instead of `unknown`) because `unknown` is bivariant
 * with function parameters only when the source type is also `unknown` —
 * typed callables like `(id: string, pos: Vec3) => void` don't satisfy a
 * `(...args: unknown[]) => unknown` constraint. `any[] → any` matches the
 * shape of every vi.fn() spy we cast to internally, so it's the right
 * width for this cast site.
 */
function mockOf(fn: (...args: any[]) => any): MockFn {
  return fn as unknown as MockFn;
}

/** Fields a drag handler actually reads off a ThreeEvent. */
type HandlerEventFields = {
  target: EventTarget | null;
  pointerId: number;
  point: { y: number };
  stopPropagation: () => void;
};

/**
 * Synthetic ThreeEvent with only the fields the handlers touch.
 * Cast `unknown → ThreeEvent<PointerEvent>` because R3F's full type
 * requires `intersections`, `ray`, `camera`, etc. — we don't want
 * to build a THREE scene just to test a command-pattern fn.
 */
function makeEvent(
  fields: Partial<HandlerEventFields> = {},
): ThreeEvent<PointerEvent> {
  return {
    target: null,
    pointerId: 1,
    point: { y: 0.5 * U },
    stopPropagation: vi.fn(),
    ...fields,
  } as unknown as ThreeEvent<PointerEvent>;
}

/**
 * Spy-wired `DragInteractionContext` with sane defaults. Override
 * any field via the `overrides` argument — last-write-wins.
 *
 * Footgun warning: the default `readPersistentState` captures
 * `defaultHardware` in its closure. If a caller overrides
 * `hardware` without also overriding `readPersistentState`, the
 * snapshot still references the ORIGINAL hardware and the move
 * handler reads stale data. Either pass an explicit
 * `readPersistentState` override or restructure the test to use
 * the default hardware.
 */
function makeCtx(
  overrides: Partial<DragInteractionContext> = {},
): DragInteractionContext {
  const defaultHardware: HardwareProps = {
    id: 'A',
    type: 'server',
    rackUnits: 1,
    position: [0, 0.5 * U, 0],
    powerDraw: 100,
    depth: 0.6,
  };
  // Resolve the FINAL hardware ONCE so the lazy snapshot closure
  // captures the post-override value (not the original default).
  // Callers overriding `hardware` without also overriding
  // `readPersistentState` get a fresh snapshot.
  //
  // Each field is assigned via `??` (or `finalHardware` directly)
  // so the literal has the full `DragInteractionContext` shape —
  // spreading `overrides: Partial<...>` would leak `| undefined`
  // into the inferred spread type and break the return-type
  // assertion. Verbose, but the type story is airtight.
  const finalHardware = overrides.hardware ?? defaultHardware;
  return {
    hardware: finalHardware,
    isDragging: overrides.isDragging ?? false,
    setIsDragging: overrides.setIsDragging ?? vi.fn(),
    capturedPointerIdRef:
      overrides.capturedPointerIdRef ?? { current: null },
    selectHardware: overrides.selectHardware ?? vi.fn(),
    updateHardwarePosition:
      overrides.updateHardwarePosition ?? vi.fn(),
    readPersistentState:
      overrides.readPersistentState ??
      vi.fn(() => ({
        capacity: CAPACITY,
        installedHardware: [finalHardware],
      })),
    beginDrag: overrides.beginDrag ?? vi.fn(),
    updateDropPosition: overrides.updateDropPosition ?? vi.fn(),
    endDrag: overrides.endDrag ?? vi.fn(),
  };
}

// ===========================================================================
// 1. handlePointerDown
// ===========================================================================

describe('handlePointerDown', () => {
  it('calls e.stopPropagation exactly once', () => {
    const e = makeEvent();
    handlePointerDown(e, makeCtx());
    expect(e.stopPropagation).toHaveBeenCalledOnce();
  });

  it('publishes the initial drag state — select, beginDrag, setIsDragging(true)', () => {
    const ctx = makeCtx({
      hardware: {
        ...makeCtx().hardware,
        id: 'B',
        rackUnits: 2,
        depth: 0.8,
      },
    });
    handlePointerDown(makeEvent(), ctx);
    expect(ctx.selectHardware).toHaveBeenCalledTimes(1);
    expect(ctx.selectHardware).toHaveBeenCalledWith('B');
    expect(ctx.beginDrag).toHaveBeenCalledTimes(1);
    expect(ctx.beginDrag).toHaveBeenCalledWith({
      id: 'B',
      rackUnits: 2,
      depth: 0.8,
    });
    expect(ctx.setIsDragging).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledWith(true);
  });

  it('calls setPointerCapture on an Element target and stashes the pointerId', () => {
    const canvas = new StubElement();
    const ctx = makeCtx();
    handlePointerDown(
      makeEvent({ target: canvas, pointerId: 7 }),
      ctx,
    );
    expect(canvas.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(ctx.capturedPointerIdRef.current).toBe(7);
  });

  it('does NOT throw on null target — capture skipped, drag lifecycle still advances', () => {
    const ctx = makeCtx();
    expect(() =>
      handlePointerDown(makeEvent({ target: null }), ctx),
    ).not.toThrow();
    // Drag lifecycle completed past the (skipped) capture call.
    expect(ctx.beginDrag).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledWith(true);
    // The handler unconditionally stashes the ref even when capture
    // failed — capturedPointerIdRef.current is the passed pointerId (1).
    expect(ctx.capturedPointerIdRef.current).toBe(1);
  });

  it('does NOT throw when target is a non-Element EventTarget stub', () => {
    // A plain object satisfying EventTarget but not Element exercises
    // the asElement fallback differently from null.
    const nonElement: EventTarget = Object.create(null);
    const ctx = makeCtx();
    expect(() =>
      handlePointerDown(makeEvent({ target: nonElement }), ctx),
    ).not.toThrow();
    expect(ctx.capturedPointerIdRef.current).toBe(1);
  });
});

// ===========================================================================
// 2. handlePointerMove
// ===========================================================================

describe('handlePointerMove', () => {
  it('bails BEFORE stopPropagation when isDragging is false (no snap, no store writes)', () => {
    const e = makeEvent({ point: { y: 0.6 * U } });
    const ctx = makeCtx({ isDragging: false });
    handlePointerMove(e, ctx);
    // Per the handler — `if (!ctx.isDragging) return` happens BEFORE
    // e.stopPropagation() is called.
    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(ctx.updateHardwarePosition).not.toHaveBeenCalled();
    expect(ctx.updateDropPosition).not.toHaveBeenCalled();
    expect(ctx.readPersistentState).not.toHaveBeenCalled();
  });

  it('snaps a 1U chassis cursor at 0.6U down to slot centre 0.5U (odd parity)', () => {
    const ctx = makeCtx({ isDragging: true });
    handlePointerMove(
      makeEvent({ point: { y: 0.6 * U } }),
      ctx,
    );
    expect(ctx.updateHardwarePosition).toHaveBeenCalledTimes(1);
    const calls = mockOf(ctx.updateHardwarePosition).mock.calls[0];
    expect(calls[0]).toBe('A');
    // Y component of the nextPosition should be 0.5U (snap target).
    expect(calls[1][1]).toBeCloseTo(0.5 * U, 10);
    expect(ctx.updateDropPosition).toHaveBeenCalledTimes(1);
  });

  it('snaps a 2U chassis cursor at 1.4U to seam U (even parity)', () => {
    const ctx = makeCtx({
      isDragging: true,
      hardware: {
        id: 'A',
        type: 'server',
        rackUnits: 2,
        position: [0, 1 * U, 0],
        powerDraw: 100,
        depth: 0.6,
      },
    });
    handlePointerMove(
      makeEvent({ point: { y: 1.4 * U } }),
      ctx,
    );
    expect(ctx.updateHardwarePosition).toHaveBeenCalledTimes(1);
    const nextPosition = mockOf(ctx.updateHardwarePosition).mock.calls[0][1];
    // snapToU(1.4U, 2) → 1.0U (round-half-up-on-even branch).
    expect(nextPosition[1]).toBeCloseTo(1.0 * U, 10);
  });

  it('writes [x, snappedY, z] preserving the X/Z from the persistent store snapshot', () => {
    const ctx = makeCtx({
      isDragging: true,
      hardware: {
        id: 'A',
        type: 'server',
        rackUnits: 1,
        position: [0, 0.5 * U, 0],
        powerDraw: 100,
        depth: 0.6,
      },
      readPersistentState: () => ({
        capacity: CAPACITY,
        installedHardware: [
          {
            id: 'A',
            type: 'server',
            rackUnits: 1,
            position: [3.7, 7.5 * U, 9.1],
            powerDraw: 100,
            depth: 0.6,
          },
        ],
      }),
    });
    handlePointerMove(
      makeEvent({ point: { y: 0.5 * U } }),
      ctx,
    );
    expect(ctx.updateHardwarePosition).toHaveBeenCalledTimes(1);
    expect(ctx.updateHardwarePosition).toHaveBeenCalledWith('A', [
      3.7,
      0.5 * U,
      9.1,
    ]);
  });

  it('routes via ctx.readPersistentState — never reads the store directly', () => {
    const readSpy = vi.fn(() => ({
      capacity: CAPACITY,
      installedHardware: [],
    }));
    const ctx = makeCtx({
      isDragging: true,
      readPersistentState: readSpy,
    });
    handlePointerMove(makeEvent(), ctx);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to hardware.position[0] / [2] when current chassis is missing from snapshot', () => {
    // The handler does `persistent.installedHardware.find(...)`. If
    // the dragged chassis isn't in the snapshot (race or empty rack
    // post-deletion), it falls back to `hardware.position[0]` /
    // `hardware.position[2]`.
    const ctx = makeCtx({
      isDragging: true,
      hardware: {
        id: 'A',
        type: 'server',
        rackUnits: 1,
        position: [4.2, 0.5 * U, 8.3],
        powerDraw: 100,
        depth: 0.6,
      },
      readPersistentState: () => ({
        capacity: CAPACITY,
        installedHardware: [], // empty: dragged chassis "missing".
      }),
    });
    handlePointerMove(makeEvent(), ctx);
    expect(ctx.updateHardwarePosition).toHaveBeenCalledTimes(1);
    expect(ctx.updateHardwarePosition).toHaveBeenCalledWith(
      'A',
      [4.2, expect.any(Number), 8.3],
    );
  });
});

// ===========================================================================
// 3. handlePointerUp
// ===========================================================================

describe('handlePointerUp', () => {
  it('calls e.stopPropagation exactly once', () => {
    const e = makeEvent();
    handlePointerUp(e, makeCtx());
    expect(e.stopPropagation).toHaveBeenCalledOnce();
  });

  it('flips setIsDragging(false) and dispatches ctx.endDrag', () => {
    const ctx = makeCtx();
    handlePointerUp(makeEvent(), ctx);
    expect(ctx.setIsDragging).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledWith(false);
    expect(ctx.endDrag).toHaveBeenCalledTimes(1);
  });

  it('calls releasePointerCapture when target.hasPointerCapture(pointerId) is true', () => {
    const canvas = new StubElement();
    canvas.hasPointerCapture.mockReturnValue(true);
    const ctx = makeCtx();
    handlePointerUp(
      makeEvent({ target: canvas, pointerId: 9 }),
      ctx,
    );
    expect(canvas.hasPointerCapture).toHaveBeenCalledTimes(1);
    expect(canvas.hasPointerCapture).toHaveBeenCalledWith(9);
    expect(canvas.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(9);
  });

  it('skips releasePointerCapture when target.hasPointerCapture returns false', () => {
    const canvas = new StubElement();
    canvas.hasPointerCapture.mockReturnValue(false);
    const ctx = makeCtx();
    handlePointerUp(
      makeEvent({ target: canvas, pointerId: 9 }),
      ctx,
    );
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled();
    // State still advanced correctly even when release was a no-op.
    expect(ctx.setIsDragging).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledWith(false);
    expect(ctx.endDrag).toHaveBeenCalledTimes(1);
  });

  it('clears capturedPointerIdRef.current to null', () => {
    const ctx = makeCtx({ capturedPointerIdRef: { current: 5 } });
    handlePointerUp(makeEvent(), ctx);
    expect(ctx.capturedPointerIdRef.current).toBeNull();
  });

  it('does NOT throw on null target', () => {
    const ctx = makeCtx();
    expect(() =>
      handlePointerUp(makeEvent({ target: null }), ctx),
    ).not.toThrow();
    // Up lifecycle still completed past the (skipped) release call.
    expect(ctx.setIsDragging).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledWith(false);
    expect(ctx.endDrag).toHaveBeenCalledTimes(1);
    expect(ctx.capturedPointerIdRef.current).toBeNull();
  });
});

// ===========================================================================
// 4. Drag cycle integration
// ===========================================================================

describe('drag cycle integration', () => {
  it('down → move → up exercises the full happy path', () => {
    const canvas = new StubElement();
    canvas.hasPointerCapture.mockReturnValue(true);
    const ctx = makeCtx({ isDragging: false });

    // pointerdown on the canvas at pointerId=3, cursor at slot-0 centre.
    handlePointerDown(
      makeEvent({ target: canvas, pointerId: 3, point: { y: 0.5 * U } }),
      ctx,
    );

    // After down: state advanced, capture attempted, ref stashed.
    expect(ctx.setIsDragging).toHaveBeenLastCalledWith(true);
    expect(ctx.beginDrag).toHaveBeenCalledTimes(1);
    expect(ctx.selectHardware).toHaveBeenCalledTimes(1);
    expect(ctx.selectHardware).toHaveBeenCalledWith('A');
    expect(canvas.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(3);
    expect(ctx.capturedPointerIdRef.current).toBe(3);

    // Simulate the user dragging slightly — pointermove with the
    // (manually flipped) isDragging=true. Each tick reads the
    // persistent snapshot freshly via ctx.readPersistentState.
    ctx.isDragging = true;
    handlePointerMove(
      makeEvent({ target: canvas, pointerId: 3, point: { y: 0.51 * U } }),
      ctx,
    );
    expect(ctx.updateHardwarePosition).toHaveBeenCalledTimes(1);
    expect(ctx.updateDropPosition).toHaveBeenCalledTimes(1);

    // pointerup on the same canvas — capture is released.
    handlePointerUp(
      makeEvent({ target: canvas, pointerId: 3 }),
      ctx,
    );

    expect(ctx.setIsDragging).toHaveBeenLastCalledWith(false);
    expect(ctx.endDrag).toHaveBeenCalledTimes(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(3);
    expect(ctx.capturedPointerIdRef.current).toBeNull();
  });

  it('cancel-via-pointerup: state cleared even when target.hasPointerCapture is false', () => {
    const canvas = new StubElement();
    canvas.hasPointerCapture.mockReturnValue(false);
    const ctx = makeCtx({ isDragging: true });
    handlePointerUp(
      makeEvent({ target: canvas, pointerId: 42 }),
      ctx,
    );
    // Release was a no-op…
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled();
    // …but isDragging + endDrag + ref-clear all still ran.
    expect(ctx.setIsDragging).toHaveBeenCalledTimes(1);
    expect(ctx.setIsDragging).toHaveBeenCalledWith(false);
    expect(ctx.endDrag).toHaveBeenCalledTimes(1);
    expect(ctx.capturedPointerIdRef.current).toBeNull();
  });
});
