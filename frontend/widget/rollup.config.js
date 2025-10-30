/**
 * Rollup configuration for Insite widget
 * Builds a single UMD bundle that exposes window.Insite.init()
 */

import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/insite-widget.js",
      format: "iife",
      name: "Insite",
      sourcemap: true,
      banner: "/* Insite Widget v1.0.0 | (c) Insite | https://insite.com */"
    }
  ],
  plugins: [
    resolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "./dist"
    })
  ]
};
