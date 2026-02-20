/**
 * @fileoverview ESLint plugin that ensures trx is forwarded to Objection.js database calls
 * @author Adithya Jayasankar
 */

import { readFileSync } from "node:fs";
import requireTrxForwarding from "./rules/require-trx-forwarding.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const plugin = {
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules: {
    "require-trx-forwarding": requireTrxForwarding,
  },
};

plugin.configs = {
  recommended: {
    plugins: { "objection-trx": plugin },
    rules: { "objection-trx/require-trx-forwarding": "error" },
  },
};

export default plugin;
