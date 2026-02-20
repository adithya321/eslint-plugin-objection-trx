/**
 * @fileoverview Ensures `trx` is forwarded to Objection.js database calls
 * inside functions that have a `trx` parameter or local variable available.
 *
 * Detects:
 *  - `.query()` called without `trx` as first arg  →  should be `.query(trx)`
 *  - `.$query()` called without `trx` as first arg →  should be `.$query(trx)`
 *  - `.$relatedQuery(x)` without `trx` as second arg →  should be `.$relatedQuery(x, trx)`
 *  - `.$fetchGraph(x)` without `{ transaction: trx }` option
 *  - `.transacting(trx)` usage → should use `{ transaction: trx }` option instead
 */

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require forwarding `trx` to Objection.js database calls when available. " +
        "Only detects the identifier named exactly `trx` — variables named `tx`, `transaction`, etc. are ignored.",
      url: "https://github.com/adithya321/eslint-plugin-objection-trx/blob/main/docs/rules/require-trx-forwarding.md",
    },
    fixable: "code",
    messages: {
      missingTrxQuery:
        "`.query()` called without `trx` inside a function that has `trx` available. Pass `trx` as the first argument.",
      missingTrxInstanceQuery:
        "`.$query()` called without `trx` inside a function that has `trx` available. Pass `trx` as the first argument.",
      missingTrxRelatedQuery:
        "`.$relatedQuery()` called without `trx` inside a function that has `trx` available. Pass `trx` as the second argument.",
      missingTrxFetchGraph:
        "`.$fetchGraph()` called without `{ transaction: trx }` inside a function that has `trx` available. Pass `{ transaction: trx }` as the second argument.",
      preferTransactionOption:
        "`.transacting()` is deprecated in Objection.js in favor of passing `{ transaction: trx }` as an option to the query method.",
    },
    schema: [],
  },

  create(context) {
    const { sourceCode } = context;

    // Track trx.commit() / trx.rollback() positions per function scope.
    // When a query call appears after a commit/rollback in the same
    // (or an ancestor) function scope, the transaction is no longer
    // usable — we must NOT suggest adding `trx`.
    const functionStack = [];

    function enterFunction() {
      functionStack.push([]);
    }

    function exitFunction() {
      functionStack.pop();
    }

    /**
     * Return `true` when a `trx.commit()` or `trx.rollback()` call
     * appears at a source position before `node` in the current or
     * any ancestor function scope on the stack.
     */
    function isAfterTrxFinalized(node) {
      for (const positions of functionStack) {
        for (const pos of positions) {
          if (pos < node.range[0]) return true;
        }
      }
      return false;
    }

    return {
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,

      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== "MemberExpression" || callee.computed) return;

        const methodName = callee.property.name;

        // Record trx.commit() and trx.rollback() positions so that
        // later queries in the same scope are not flagged.
        if (
          (methodName === "commit" || methodName === "rollback") &&
          callee.object.type === "Identifier" &&
          callee.object.name === "trx" &&
          functionStack.length > 0
        ) {
          functionStack[functionStack.length - 1].push(node.range[0]);
        }

        if (methodName === "query") {
          if (
            looksLikeModelClass(callee.object) &&
            !isTrxForwarded(node.arguments[0]) &&
            hasTrxInScope(node, sourceCode) &&
            !isAfterTrxFinalized(node)
          ) {
            context.report({
              node,
              messageId: "missingTrxQuery",
              fix: fixFirstArg(node, sourceCode),
            });
          }
        } else if (methodName === "$query") {
          if (
            !isTrxForwarded(node.arguments[0]) &&
            hasTrxInScope(node, sourceCode) &&
            !isAfterTrxFinalized(node)
          ) {
            context.report({
              node,
              messageId: "missingTrxInstanceQuery",
              fix: fixFirstArg(node, sourceCode),
            });
          }
        } else if (methodName === "$relatedQuery") {
          if (
            !isTrxForwarded(node.arguments[1]) &&
            hasTrxInScope(node, sourceCode) &&
            !isAfterTrxFinalized(node)
          ) {
            context.report({
              node,
              messageId: "missingTrxRelatedQuery",
              fix: fixSecondArg(node),
            });
          }
        } else if (methodName === "$fetchGraph") {
          if (
            !hasTransactionOption(node) &&
            hasTrxInScope(node, sourceCode) &&
            !isAfterTrxFinalized(node)
          ) {
            context.report({
              node,
              messageId: "missingTrxFetchGraph",
              fix: fixFetchGraphOption(node, sourceCode),
            });
          }
        } else if (methodName === "transacting") {
          // No auto-fix: restructuring .transacting() chains into
          // `{ transaction: trx }` options requires call-chain surgery.
          if (
            looksLikeObjectionChain(node) &&
            hasTrxInScope(node, sourceCode) &&
            !isAfterTrxFinalized(node)
          ) {
            context.report({ node, messageId: "preferTransactionOption" });
          }
        }
      },
    };
  },
};

/**
 * Return `true` when `arg` is the identifier `trx`.
 *
 * No "shadowing" check is needed: when multiple enclosing functions each
 * declare `trx`, the innermost binding is the one the call-site forwards,
 * which is always the correct transaction.
 */
function isTrxForwarded(arg) {
  return arg != null && arg.type === "Identifier" && arg.name === "trx";
}

/**
 * Return `true` when `objectNode` looks like an Objection.js Model class
 * (or a chain that originates from one).
 *
 * Objection.js `.query()` is a **static** method called on Model classes,
 * which follow PascalCase naming by convention (e.g. `Inventory.query(trx)`).
 * It is also common to call `.query()` on the result of a chain that starts
 * with a Model class, such as `Inventory.bindKnex(knex).query(trx)`.
 *
 * Non-Objection APIs such as the raw `pg` client (`connection.query()`) or
 * custom HTTP clients (`client.query()`) use camelCase / lowercase names.
 *
 * By requiring the **root** receiver of the chain to be a PascalCase
 * `Identifier`, we avoid false positives on unrelated `.query()` calls
 * while catching both direct and chained Objection usage in the codebase.
 */
function looksLikeModelClass(objectNode) {
  const root = resolveRootReceiver(objectNode);
  if (root == null) return false;
  // `this.query(trx)` in a static model method — `this` refers to the class
  if (root.type === "ThisExpression") return true;
  return root.type === "Identifier" && /^[A-Z]/.test(root.name);
}

/**
 * Walk through a chain of `CallExpression` / `MemberExpression` nodes
 * to find the leftmost (root) receiver.
 *
 * For example, given `Model.bindKnex(knex)`:
 *   CallExpression  →  callee: MemberExpression  →  object: Identifier("Model")
 * The root receiver is the `Identifier("Model")` node.
 */
function resolveRootReceiver(node) {
  let current = node;
  while (current) {
    if (current.type === "Identifier" || current.type === "ThisExpression") {
      return current;
    }
    if (current.type === "ChainExpression") {
      current = current.expression;
    } else if (current.type === "CallExpression") {
      current = current.callee;
    } else if (current.type === "MemberExpression") {
      current = current.object;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Return `true` when the call chain leading to `.transacting()` contains
 * an Objection.js model method (`.query()` on a PascalCase class,
 * `.$query()`, `.$relatedQuery()`, or `.$fetchGraph()`).
 *
 * Plain Knex query builders (e.g. `knex('table').where(…).transacting(trx)`)
 * do NOT go through Objection, so `.transacting(trx)` is the correct — and
 * only — way to bind them to a transaction.  We must avoid flagging those.
 */
function looksLikeObjectionChain(node) {
  let current = node.callee.object; // receiver of .transacting()
  while (current) {
    if (
      current.type === "CallExpression" &&
      current.callee.type === "MemberExpression" &&
      !current.callee.computed
    ) {
      const method = current.callee.property.name;
      if (
        method === "$query" ||
        method === "$relatedQuery" ||
        method === "$fetchGraph"
      ) {
        return true;
      }
      if (method === "query" && looksLikeModelClass(current.callee.object)) {
        return true;
      }
      current = current.callee.object;
    } else if (current.type === "ChainExpression") {
      current = current.expression;
    } else {
      break;
    }
  }
  return false;
}

/**
 * Return `true` when `node` has a binding named `trx` accessible
 * in its lexical scope.  Uses ESLint's built-in scope analysis,
 * which correctly handles parameters, variable declarations,
 * destructuring, catch clauses, and nested scopes.
 *
 * Skips the global scope so that ambient / config-level globals
 * (e.g. `globals: { trx: "readonly" }`) do not trigger the rule.
 *
 * Also checks that at least one definition of `trx` appears
 * **before** the call site, so `let`/`const` declarations that
 * come after the call (temporal dead zone) are not treated as
 * available.  Once `trx` is found in a scope the search stops,
 * because an inner binding shadows any outer `trx`.
 */
function hasTrxInScope(node, sourceCode) {
  let scope = sourceCode.getScope(node);
  while (scope) {
    if (scope.type === "global") break;
    const variable = scope.set.get("trx");
    if (variable) {
      return variable.defs.some((def) => def.node.range[0] < node.range[0]);
    }
    scope = scope.upper;
  }
  return false;
}

/**
 * Return `true` when `key` is the identifier or string literal `name`.
 * Handles both `{ transaction: trx }` (Identifier key) and
 * `{ "transaction": trx }` (Literal / string key).
 */
function isKeyNamed(key, name) {
  if (key.type === "Identifier") return key.name === name;
  if (key.type === "Literal") return key.value === name;
  return false;
}

/**
 * For `$fetchGraph`, check whether the second argument contains
 * `{ transaction: trx }` — the value must be the identifier `trx`,
 * not an arbitrary expression.
 */
function hasTransactionOption(node) {
  const secondArg = node.arguments[1];
  if (!secondArg) return false;

  // If the second arg is a variable/expression (not an object literal),
  // we cannot statically verify it contains `{ transaction: trx }`.
  // Give the benefit of the doubt — the caller likely built an options
  // object that already includes the transaction.  Flagging these would
  // produce false positives on perfectly valid code paths.
  if (secondArg.type !== "ObjectExpression") return true;

  return secondArg.properties.some(
    (prop) =>
      prop.type === "Property" &&
      isKeyNamed(prop.key, "transaction") &&
      isTrxForwarded(prop.value),
  );
}

/**
 * Return a fixer that inserts `trx` when the argument list is empty.
 * When a wrong argument is already present, we only report — replacing
 * an existing argument could silently change program semantics.
 */
function fixFirstArg(node, sourceCode) {
  return (fixer) => {
    if (node.arguments[0]) return null; // don't replace existing args
    const openParen = sourceCode.getTokenAfter(node.callee, {
      filter: (t) => t.value === "(",
    });
    return fixer.insertTextAfter(openParen, "trx");
  };
}

/**
 * Return a fixer that inserts `, trx` after the first argument.
 * When a wrong second argument is already present, we only report —
 * replacing an existing argument could silently change program semantics.
 */
function fixSecondArg(node) {
  return (fixer) => {
    if (node.arguments[1]) return null; // don't replace existing args
    const firstArg = node.arguments[0];
    if (!firstArg) return null;
    return fixer.insertTextAfter(firstArg, ", trx");
  };
}

/**
 * Return a fixer that adds `{ transaction: trx }` as the second argument
 * to `.$fetchGraph()`, or inserts the `transaction: trx` property into
 * an existing object literal.
 */
function fixFetchGraphOption(node, sourceCode) {
  return (fixer) => {
    const secondArg = node.arguments[1];
    if (!secondArg) {
      const firstArg = node.arguments[0];
      if (!firstArg) return null;
      return fixer.insertTextAfter(firstArg, ", { transaction: trx }");
    }
    if (secondArg.type !== "ObjectExpression") return null;
    const txProp = secondArg.properties.find(
      (p) => p.type === "Property" && isKeyNamed(p.key, "transaction"),
    );
    if (txProp) {
      return null; // don't replace existing transaction value
    }
    const openBrace = sourceCode.getFirstToken(secondArg);
    if (secondArg.properties.length > 0) {
      // Insert before existing properties so that spread operators
      // cannot accidentally override the transaction binding.
      return fixer.insertTextAfter(openBrace, " transaction: trx,");
    }
    return fixer.replaceText(secondArg, "{ transaction: trx }");
  };
}

export default rule;
