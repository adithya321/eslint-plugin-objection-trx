/**
 * @fileoverview ESLint plugin that ensures trx is forwarded to Objection.js database calls
 * @author Adithya Jayasankar
 */

import requireTrxForwarding from "./rules/require-trx-forwarding.js";

const plugin = {
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
