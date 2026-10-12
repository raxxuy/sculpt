import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    transforms: "src/transforms/index.ts",
    derivations: "src/derivations/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
