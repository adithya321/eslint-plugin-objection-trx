# eslint-plugin-objection-trx

ESLint plugin that ensures `trx` is forwarded to [Objection.js](https://vincit.github.io/objection.js/) database calls.

Catches a common source of bugs in codebases that use Objection.js transactions: forgetting to pass the `trx` (transaction) object to query methods, which causes queries to run outside the transaction and leads to data inconsistencies.

## Installation

```sh
npm install --save-dev eslint-plugin-objection-trx
```

Requires ESLint >= 9.15.0 (flat config).

## Usage

### Recommended config

```js
// eslint.config.js
import objectionTrx from "eslint-plugin-objection-trx";

export default [
  objectionTrx.configs.recommended,
  // ... your other configs
];
```

### Manual config

```js
// eslint.config.js
import objectionTrx from "eslint-plugin-objection-trx";

export default [
  {
    plugins: { "objection-trx": objectionTrx },
    rules: {
      "objection-trx/require-trx-forwarding": "error",
    },
  },
];
```

## Rules

<!-- begin auto-generated rules list -->

💼 Configurations enabled in.\
✅ Set in the `recommended` configuration.\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).

| Name                                                           | Description                                                                                                                                                                      | 💼 | 🔧 |
| :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :- | :- |
| [require-trx-forwarding](docs/rules/require-trx-forwarding.md) | Require forwarding `trx` to Objection.js database calls when available. Only detects the identifier named exactly `trx` — variables named `tx`, `transaction`, etc. are ignored. | ✅  | 🔧 |

<!-- end auto-generated rules list -->

## Rule: `require-trx-forwarding`

When a function has `trx` available in scope (as a parameter, destructured binding, or local variable), this rule ensures it is forwarded to Objection.js query methods.

> **Note:** The rule only detects the identifier named exactly `trx`. Variables named `tx`, `transaction`, etc. are ignored.

### What it detects

| Pattern                             | Expected fix                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| `Model.query()`                     | `Model.query(trx)`                                         |
| `item.$query()`                     | `item.$query(trx)`                                         |
| `item.$relatedQuery("rel")`         | `item.$relatedQuery("rel", trx)`                           |
| `item.$fetchGraph(expr)`            | `item.$fetchGraph(expr, { transaction: trx })`             |
| `Model.query(trx).transacting(trx)` | Remove `.transacting()` in favor of passing `trx` directly |

### Auto-fix

The rule provides auto-fixes for the first four patterns when the argument slot is empty. It will **not** auto-replace an existing argument to avoid silently changing program semantics.

The `.transacting()` deprecation warning is reported without an auto-fix since restructuring call chains requires manual review.

### False-positive avoidance

- `.query()` on **camelCase** receivers (e.g. `connection.query()`, `pool.query()`) is ignored — only PascalCase class names (Objection Model convention) are flagged.
- `.transacting()` on plain Knex query builders (e.g. `knex('table').transacting(trx)`) is **not** flagged — `.transacting()` is the correct API for raw Knex queries.
- `.$fetchGraph()` with a non-literal second argument (e.g. a variable or function call) is assumed to already contain the transaction option.

### Examples

#### Pass

```js
async function save(trx) {
  await Model.query(trx).findById(1);
  await item.$query(trx).patch(data);
  await item.$relatedQuery("tags", trx);
  await item.$fetchGraph(expr, { transaction: trx });
}
```

#### Fail

```js
async function save(trx) {
  // Each line below triggers a lint error:
  await Model.query().findById(1); // missing trx in .query()
  await item.$query().patch(data); // missing trx in .$query()
  await item.$relatedQuery("tags"); // missing trx in .$relatedQuery()
  await item.$fetchGraph(expr); // missing { transaction: trx }
  await Model.query(trx).transacting(trx); // use query(trx) instead of .transacting()
}
```

## License

MIT
