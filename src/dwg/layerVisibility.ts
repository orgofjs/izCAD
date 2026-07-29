export type SavedDwgLayerState = {
  off: boolean;
  frozen: boolean;
  frozenInNewViewport: boolean;
};

export type SavedDwgLayerStates = ReadonlyMap<
  string,
  SavedDwgLayerState
>;

type Line = {
  start: number;
  end: number;
  next: number;
};

type Replacement = {
  start: number;
  end: number;
  bytes: Uint8Array;
};

type LayerRecord = {
  name?: string;
  color?: Line;
  flags?: Line;
};

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

function readLine(bytes: Uint8Array, start: number): Line | null {
  if (start >= bytes.byteLength) {
    return null;
  }

  let end = start;
  while (
    end < bytes.byteLength &&
    bytes[end] !== 0x0a &&
    bytes[end] !== 0x0d
  ) {
    end += 1;
  }

  let next = end;
  if (bytes[next] === 0x0d) {
    next += 1;
  }
  if (bytes[next] === 0x0a) {
    next += 1;
  }

  return { start, end, next };
}

function decodeLine(bytes: Uint8Array, line: Line): string {
  return decoder.decode(bytes.subarray(line.start, line.end)).trim();
}

function parseInteger(bytes: Uint8Array, line: Line): number | null {
  const value = Number.parseInt(decodeLine(bytes, line), 10);
  return Number.isFinite(value) ? value : null;
}

function encodeLikeLine(
  bytes: Uint8Array,
  line: Line,
  value: number,
): Uint8Array {
  const original = decoder.decode(bytes.subarray(line.start, line.end));
  const indentation = original.match(/^\s*/)?.[0] ?? "";
  return encoder.encode(`${indentation}${value}`);
}

function findLayerState(
  states: SavedDwgLayerStates,
  foldedStates: ReadonlyMap<string, SavedDwgLayerState>,
  name: string,
): SavedDwgLayerState | undefined {
  return (
    states.get(name) ??
    foldedStates.get(name.toLocaleUpperCase("en-US"))
  );
}

function applyReplacements(
  source: Uint8Array,
  replacements: readonly Replacement[],
): Uint8Array {
  if (replacements.length === 0) {
    return source;
  }

  const orderedReplacements = [...replacements].sort(
    (left, right) => left.start - right.start,
  );
  const targetSize = orderedReplacements.reduce(
    (size, replacement) =>
      size -
      (replacement.end - replacement.start) +
      replacement.bytes.byteLength,
    source.byteLength,
  );
  const target = new Uint8Array(targetSize);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (const replacement of orderedReplacements) {
    const unchanged = source.subarray(
      sourceOffset,
      replacement.start,
    );
    target.set(unchanged, targetOffset);
    targetOffset += unchanged.byteLength;
    target.set(replacement.bytes, targetOffset);
    targetOffset += replacement.bytes.byteLength;
    sourceOffset = replacement.end;
  }

  target.set(source.subarray(sourceOffset), targetOffset);
  return target;
}

/**
 * The pinned @mlightcad/libredwg-web 0.7.9 runtime exports every AC1032
 * DWG layer color as a negative DXF group-62 value for some drawings. A
 * negative value means "layer off", so trusting the generated DXF makes a
 * valid drawing empty.
 *
 * Restore group 62 and the frozen bits in group 70 from the layer records
 * read directly from the source DWG. If those records cannot be read, make
 * generated layers visible to preserve the previous working behavior.
 */
export function restoreDxfLayerStates(
  source: Uint8Array,
  savedStates: SavedDwgLayerStates | null,
): Uint8Array {
  const foldedStates = new Map<string, SavedDwgLayerState>();
  if (savedStates) {
    for (const [name, state] of savedStates) {
      foldedStates.set(name.toLocaleUpperCase("en-US"), state);
    }
  }

  const replacements: Replacement[] = [];
  let offset = 0;
  let currentRecord = "";
  let currentLayer: LayerRecord | null = null;
  let foundLayerRecord = false;

  const finishLayer = () => {
    if (!currentLayer) {
      return;
    }

    const state =
      savedStates && currentLayer.name
        ? findLayerState(savedStates, foldedStates, currentLayer.name)
        : undefined;

    if (currentLayer.color) {
      const currentColor = parseInteger(source, currentLayer.color);
      if (currentColor !== null) {
        const colorIndex = Math.abs(currentColor);
        const desiredColor = state?.off ? -colorIndex : colorIndex;
        if (desiredColor !== currentColor) {
          replacements.push({
            start: currentLayer.color.start,
            end: currentLayer.color.end,
            bytes: encodeLikeLine(
              source,
              currentLayer.color,
              desiredColor,
            ),
          });
        }
      }
    }

    if (state && currentLayer.flags) {
      const currentFlags = parseInteger(source, currentLayer.flags);
      if (currentFlags !== null) {
        const desiredFlags =
          (currentFlags & ~3) |
          (state.frozen ? 1 : 0) |
          (state.frozenInNewViewport ? 2 : 0);
        if (desiredFlags !== currentFlags) {
          replacements.push({
            start: currentLayer.flags.start,
            end: currentLayer.flags.end,
            bytes: encodeLikeLine(
              source,
              currentLayer.flags,
              desiredFlags,
            ),
          });
        }
      }
    }
  };

  while (offset < source.byteLength) {
    const codeLine = readLine(source, offset);
    if (!codeLine) {
      break;
    }
    const valueLine = readLine(source, codeLine.next);
    if (!valueLine) {
      break;
    }
    offset = valueLine.next;

    const code = parseInteger(source, codeLine);
    if (code === 0) {
      if (currentRecord === "LAYER") {
        finishLayer();
      }

      currentRecord = decodeLine(source, valueLine);
      currentLayer =
        currentRecord === "LAYER" ? {} : null;
      if (currentLayer) {
        foundLayerRecord = true;
      } else if (foundLayerRecord && currentRecord === "ENDTAB") {
        break;
      }
      continue;
    }

    if (!currentLayer) {
      continue;
    }

    if (code === 2) {
      currentLayer.name = decodeLine(source, valueLine);
    } else if (code === 62) {
      currentLayer.color = valueLine;
    } else if (code === 70) {
      currentLayer.flags = valueLine;
    }
  }

  return applyReplacements(source, replacements);
}
