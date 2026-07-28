# LibreDWG offline runtime

The application contains one pinned, device-local DWG to DXF engine:

- `@mlightcad/libredwg-web@0.7.9`

`npm run build` runs `scripts/copy-cad-runtime.mjs`, which copies its
JavaScript and WebAssembly files into this directory. Vite then copies them
into the Android web assets, so no server or network request is needed.

DWG conversion runs in a dedicated Web Worker so a native parser error cannot
freeze the React interface, and cancelling the loading screen terminates the
worker and releases its memory.
