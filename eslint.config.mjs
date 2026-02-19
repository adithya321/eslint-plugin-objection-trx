import pluginJs from "@eslint/js";
import eslintPlugin from "eslint-plugin-eslint-plugin";
import pluginNode from "eslint-plugin-n";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    name: "eslint/js",
    plugins: {
      js: pluginJs,
    },
    extends: ["js/recommended"],
  },
  {
    name: "eslint/node",
    plugins: {
      n: pluginNode,
    },
    extends: ["n/flat/mixed-esm-and-cjs"],
  },
  {
    name: "eslint/eslint-plugin",
    plugins: {
      "eslint-plugin": eslintPlugin,
    },
    extends: ["eslint-plugin/flat/recommended"],
  },
]);
