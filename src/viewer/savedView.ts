export type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type SavedDrawingView = {
  center: DrawingPoint;
  viewHeight: number;
  aspectRatio?: number;
  twistAngle?: number;
};

export type ResolvedDrawingView = {
  center: DrawingPoint;
  width: number;
};

const savedViews = new WeakMap<File, SavedDrawingView>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeSavedDrawingView(
  view: SavedDrawingView,
): SavedDrawingView | null {
  if (
    !isFiniteNumber(view.center.x) ||
    !isFiniteNumber(view.center.y) ||
    !isFiniteNumber(view.viewHeight) ||
    view.viewHeight <= 0
  ) {
    return null;
  }

  const aspectRatio =
    isFiniteNumber(view.aspectRatio) && view.aspectRatio > 0
      ? view.aspectRatio
      : undefined;
  const twistAngle = isFiniteNumber(view.twistAngle)
    ? view.twistAngle
    : undefined;

  return {
    center: {
      x: view.center.x,
      y: view.center.y,
    },
    viewHeight: view.viewHeight,
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    ...(twistAngle === undefined ? {} : { twistAngle }),
  };
}

export function registerSavedDrawingView(
  file: File,
  view: SavedDrawingView | null,
): void {
  if (!view) {
    return;
  }

  const normalized = normalizeSavedDrawingView(view);
  if (normalized) {
    savedViews.set(file, normalized);
  }
}

export function getSavedDrawingView(
  file: File,
): SavedDrawingView | null {
  return savedViews.get(file) ?? null;
}

export function resolveSavedDrawingView(
  view: SavedDrawingView | null,
  bounds: DrawingBounds | null,
  origin: DrawingPoint,
  viewportAspect: number,
): ResolvedDrawingView | null {
  if (
    !view ||
    !bounds ||
    !isFiniteNumber(viewportAspect) ||
    viewportAspect <= 0
  ) {
    return null;
  }

  const normalized = normalizeSavedDrawingView(view);
  if (!normalized) {
    return null;
  }

  const halfHeight = normalized.viewHeight / 2;
  const halfWidth = halfHeight * viewportAspect;
  const viewMinX = normalized.center.x - halfWidth;
  const viewMaxX = normalized.center.x + halfWidth;
  const viewMinY = normalized.center.y - halfHeight;
  const viewMaxY = normalized.center.y + halfHeight;
  const intersectsDrawing =
    viewMaxX >= bounds.minX &&
    viewMinX <= bounds.maxX &&
    viewMaxY >= bounds.minY &&
    viewMinY <= bounds.maxY;

  if (!intersectsDrawing) {
    return null;
  }

  return {
    center: {
      x: normalized.center.x - origin.x,
      y: normalized.center.y - origin.y,
    },
    // VIEWSIZE is the saved vertical field of view. Preserve the complete
    // saved desktop rectangle on narrower phone screens instead of cropping
    // it horizontally and making neighbouring sheets look overlapped.
    width:
      normalized.viewHeight *
      Math.max(normalized.aspectRatio ?? viewportAspect, viewportAspect),
  };
}
