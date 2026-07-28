import { describe, expect, it } from "vitest";
import {
  readIncomingDrawingFile,
  type IncomingDrawing,
} from "./incomingDrawing";

describe("incoming Android drawings", () => {
  it("turns a locally readable URI into a browser File", async () => {
    const drawing: IncomingDrawing = {
      id: "1",
      uri: "data:application/dxf,0%0ASECTION%0A2%0AEOF",
      name: "shared-plan.dxf",
      mimeType: "application/dxf",
      size: -1,
    };

    const file = await readIncomingDrawingFile(drawing);

    expect(file.name).toBe("shared-plan.dxf");
    expect(file.type).toBe("application/dxf");
    expect(await file.text()).toContain("SECTION");
  });
});
