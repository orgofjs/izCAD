declare module "dxf-viewer/src/DxfScene.js" {
  export class DxfScene {
    public layers: Map<string, { visible?: boolean }>;
    public blocks: Map<
      string,
      {
        flatten: boolean;
        offset: { x: number; y: number } | null;
      }
    >;
    public Build(dxf: object, fontFetchers: unknown): Promise<void>;
    public _BuildScene(): object;
    public _FilterEntity(entity: object): boolean;
    public _GetEntityLayer(entity: object): string;
    public _ProcessInsert(
      entity: object,
      blockContext?: unknown,
    ): void;
  }
}

declare module "dxf-viewer/src/parser/DxfParser.js" {
  export default class DxfParser {
    public parseSync(source: string): {
      entities: Array<{
        type?: string;
        xdata?: Record<
          string,
          {
            values?: Array<{
              code: number;
              value: unknown;
            }>;
          }
        >;
      }>;
    };
  }
}
