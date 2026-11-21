import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    transforms: "src/transforms/index.ts",
    derivations: "src/derivations/index.ts",
  },
  format: ["esm", "cjs"],
  fixedExtension: false,
  dts: true,
  clean: true,
  target: false,
});
