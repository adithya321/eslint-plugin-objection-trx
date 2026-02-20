import { RuleTester } from "eslint";
import rule from "../../../lib/rules/require-trx-forwarding.js";

const ruleTester = new RuleTester();

ruleTester.run("require-trx-forwarding", rule, {
  valid: [
    // no trx in scope — not flagged
    `function save(knex) { Model.query().findById(1); }`,
    // trx forwarded to .query()
    `function save(knex, trx) { Model.query(trx).findById(1); }`,
    // arrow function with trx forwarded
    `const save = (trx) => Model.query(trx).insert(data);`,
    // $query with trx
    `async function f(trx) { await item.$query(trx).patch(data); }`,
    // $relatedQuery with trx
    `async function f(trx) { await item.$relatedQuery("tags", trx); }`,
    // $fetchGraph with transaction option
    `async function f(trx) { await item.$fetchGraph(expr, { transaction: trx }); }`,
    // $fetchGraph with string-keyed transaction option
    `async function f(trx) { await item.$fetchGraph(expr, { "transaction": trx }); }`,
    // $fetchGraph with spread + explicit transaction key
    `async function f(trx) { await item.$fetchGraph(expr, { ...opts, transaction: trx }); }`,
    // $fetchGraph with a variable as second arg — assumed to contain transaction
    `async function f(trx) { await item.$fetchGraph(expr, opts); }`,
    // $fetchGraph with a function call as second arg — assumed to contain transaction
    `async function f(trx) { await item.$fetchGraph(expr, getOpts(trx)); }`,
    // destructured params — no trx binding
    `function save({ knex }) { Model.query().findById(1); }`,
    // nested callback with trx correctly forwarded
    `async function save(trx) { items.map((item) => item.$relatedQuery("tags", trx)); }`,
    // no trx anywhere in the scope chain
    `function outer(knex) { items.forEach((item) => { Model.query().findById(1); }); }`,
    // non-Objection .query() — raw pg client (camelCase receiver) should not be flagged
    `function setup(trx) { connection.query("SET timezone TO 'UTC';", cb); }`,
    // non-Objection .query() — generic client should not be flagged
    `async function run(trx) { await client.query(sql); }`,
    // non-Objection .query() — pool should not be flagged
    `async function run(trx) { await pool.query("SELECT 1"); }`,
    // shadowed trx in inner callback — the inner `trx` is NOT the outer transaction,
    // but the outer trx IS correctly forwarded via closure (no shadow at query site)
    // This is the non-shadowed nested case — trx still refers to outer param
    `function save(trx) { items.map((item) => Model.query(trx).findById(1)); }`,
    // optional-chained calls with trx correctly forwarded
    `function save(trx) { Model?.query(trx).findById(1); }`,
    `async function f(trx) { await item?.$relatedQuery("tags", trx); }`,
    `async function f(trx) { await item?.$fetchGraph(expr, { transaction: trx }); }`,
    // $query with no trx in scope — not flagged
    `function save(knex) { item.$query().patch(data); }`,
    // .transacting() with no trx in scope — not flagged
    `function save(knex) { Model.query(knex).transacting(knex); }`,
    // .transacting() on plain knex query builder — valid Knex usage, not Objection
    `async function save(trx) { await knex('table').where('id', 1).transacting(trx); }`,
    // .transacting() on trx used as query builder — valid Knex usage
    `async function save(trx) { await trx('table').insert(data).transacting(trx); }`,
    // .transacting() on a generic variable — not an Objection chain
    `async function save(trx) { await qb.where('id', 1).transacting(trx); }`,
    // class method with trx correctly forwarded
    `class Repo { async save(trx) { await Model.query(trx).findById(1); } }`,
    // chained .bindKnex().query() with trx correctly forwarded
    `async function save(knex, trx) { await Model.bindKnex(knex).query(trx).findById(1); }`,
    // chained .knex(knex).query() with trx correctly forwarded
    `async function save(knex, trx) { await Model.knex(knex).query(trx).insert(data); }`,
    // deeper chain with trx forwarded
    `async function save(knex, trx) { await Model.bindKnex(knex).query(trx).where('id', 1).first(); }`,
    // non-Objection chained .query() — camelCase root should not be flagged
    `async function run(trx) { await factory.create().query(sql); }`,
    // nested functions both declaring trx — inner trx is forwarded correctly (e.g. nested transactions)
    `function save(trx) { items.map((trx) => Model.query(trx).findById(1)); }`,
    `async function save(trx) { items.map(async (trx) => { await item.$relatedQuery("tags", trx); }); }`,
    `async function save(trx) { items.map(async (trx) => { await item.$fetchGraph(expr, { transaction: trx }); }); }`,
    `function save(trx) { items.map((trx) => item.$query(trx).patch(data)); }`,
    // nested Model.transaction callback — inner trx correctly forwarded
    `function save(trx) { Model.transaction(trx, async (trx) => { Model.query(trx).findById(1); }); }`,
    `async function save(trx) { await Model.transaction(trx, async (trx) => { await item.$relatedQuery("tags", trx); }); }`,
    `async function save(trx) { await Model.transaction(trx, async (trx) => { await item.$fetchGraph(expr, { transaction: trx }); }); }`,
    // this.query(trx) in static model method — trx correctly forwarded
    `class Repo { static async save(trx) { await this.query(trx).findById(1); } }`,
    // const trx with trx correctly forwarded — not flagged
    `async function save() { const trx = await getTransaction(); Model.query(trx).findById(1); }`,
    // trx in array destructuring — correctly forwarded
    `function f([trx]) { Model.query(trx).findById(1); }`,
    // trx as rest parameter — correctly forwarded
    `function f(...trx) { Model.query(trx).findById(1); }`,
    // knex.transaction() callback — trx correctly forwarded
    `async function run() { await knex.transaction(async (trx) => { await Model.query(trx).findById(1); }); }`,
    // for...of loop with trx in outer scope — correctly forwarded
    `async function f(trx) { for (const item of items) { await Model.query(trx).findById(item.id); } }`,
    // this.$query(trx) in instance method — correctly forwarded
    `class Repo { async save(trx) { await this.$query(trx).patch(data); } }`,
    // trx destructured from object in function body — correctly forwarded
    `async function save() { const { trx } = await getTransaction(); Model.query(trx).findById(1); }`,
    // catch (trx) — correctly forwarded
    `async function save() { try { doStuff(); } catch (trx) { Model.query(trx).findById(1); } }`,
    // for...of declaring trx — correctly forwarded
    `async function save() { for (const trx of transactions) { Model.query(trx).findById(1); } }`,
    // deeply nested scope chain — trx still accessible
    `function outer(trx) { function middle() { function inner() { Model.query(trx).findById(1); } } }`,
    // trx in switch case body — correctly forwarded
    `async function f(trx) { switch (action) { case "save": Model.query(trx).findById(1); break; } }`,
  ],
  invalid: [
    {
      code: `function save(knex, trx) { Model.query().findById(1); }`,
      output: `function save(knex, trx) { Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      code: `const save = (trx) => Model.query().insert(data);`,
      output: `const save = (trx) => Model.query(trx).insert(data);`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      code: `async function f(trx) { await item.$relatedQuery("tags"); }`,
      output: `async function f(trx) { await item.$relatedQuery("tags", trx); }`,
      errors: [{ messageId: "missingTrxRelatedQuery" }],
    },
    {
      code: `async function f(trx) { await item.$fetchGraph(expr); }`,
      output: `async function f(trx) { await item.$fetchGraph(expr, { transaction: trx }); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // trx in destructured param
      code: `async function f({ trx }) { Model.query().findById(1); }`,
      output: `async function f({ trx }) { Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // trx with default value
      code: `async function f(trx = null) { Model.query().findById(1); }`,
      output: `async function f(trx = null) { Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // $fetchGraph with transaction pointing to a different variable (not trx) — no auto-fix for replacement
      code: `async function f(trx) { await item.$fetchGraph(expr, { transaction: otherTx }); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // .query() inside a nested callback — trx available from outer scope
      code: `async function save(trx) { await Promise.all(items.map(async (item) => { await Model.query().insert(item); })); }`,
      output: `async function save(trx) { await Promise.all(items.map(async (item) => { await Model.query(trx).insert(item); })); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .$relatedQuery() inside a nested arrow — trx available from outer scope
      code: `async function save(trx) { items.forEach((item) => { item.$relatedQuery("tags"); }); }`,
      output: `async function save(trx) { items.forEach((item) => { item.$relatedQuery("tags", trx); }); }`,
      errors: [{ messageId: "missingTrxRelatedQuery" }],
    },
    {
      // .$fetchGraph() inside a nested callback — trx available from outer scope
      code: `async function save(trx) { items.map((item) => item.$fetchGraph(expr)); }`,
      output: `async function save(trx) { items.map((item) => item.$fetchGraph(expr, { transaction: trx })); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // named inner function — trx still accessible via closure
      code: `function outer(trx) { function inner() { Model.query().findById(1); } }`,
      output: `function outer(trx) { function inner() { Model.query(trx).findById(1); } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .query() called with a different variable — trx not forwarded (no auto-fix for replacement)
      code: `function save(knex, trx) { Model.query(otherTx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .$relatedQuery() called with a different variable as 2nd arg (no auto-fix for replacement)
      code: `async function f(trx) { await item.$relatedQuery("tags", otherTx); }`,
      errors: [{ messageId: "missingTrxRelatedQuery" }],
    },
    {
      // .query() called with knex instead of trx (no auto-fix for replacement)
      code: `function save(knex, trx) { Model.query(knex).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // nested functions both declaring trx, but inner call does NOT forward it
      code: `function save(trx) { Model.transaction(trx, async (trx) => { Model.query().findById(1); }); }`,
      output: `function save(trx) { Model.transaction(trx, async (trx) => { Model.query(trx).findById(1); }); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // optional-chained .query() without trx
      code: `function save(trx) { Model?.query().findById(1); }`,
      output: `function save(trx) { Model?.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // optional-chained .$relatedQuery() without trx
      code: `async function f(trx) { await item?.$relatedQuery("tags"); }`,
      output: `async function f(trx) { await item?.$relatedQuery("tags", trx); }`,
      errors: [{ messageId: "missingTrxRelatedQuery" }],
    },
    {
      // optional-chained .$fetchGraph() without trx
      code: `async function f(trx) { await item?.$fetchGraph(expr); }`,
      output: `async function f(trx) { await item?.$fetchGraph(expr, { transaction: trx }); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // .$query() without trx
      code: `async function f(trx) { await item.$query().patch(data); }`,
      output: `async function f(trx) { await item.$query(trx).patch(data); }`,
      errors: [{ messageId: "missingTrxInstanceQuery" }],
    },
    {
      // .$query() with wrong variable (no auto-fix for replacement)
      code: `async function f(trx) { await item.$query(otherTx).patch(data); }`,
      errors: [{ messageId: "missingTrxInstanceQuery" }],
    },
    {
      // .$query() inside nested callback — trx available from outer scope
      code: `async function save(trx) { items.map((item) => item.$query().patch(data)); }`,
      output: `async function save(trx) { items.map((item) => item.$query(trx).patch(data)); }`,
      errors: [{ messageId: "missingTrxInstanceQuery" }],
    },
    {
      // optional-chained .$query() without trx
      code: `async function f(trx) { await item?.$query().patch(data); }`,
      output: `async function f(trx) { await item?.$query(trx).patch(data); }`,
      errors: [{ messageId: "missingTrxInstanceQuery" }],
    },
    {
      // nested functions both declaring trx, but inner call does NOT forward it (.$query)
      code: `function save(trx) { Model.transaction(trx, async (trx) => { item.$query().patch(data); }); }`,
      output: `function save(trx) { Model.transaction(trx, async (trx) => { item.$query(trx).patch(data); }); }`,
      errors: [{ messageId: "missingTrxInstanceQuery" }],
    },
    {
      // .transacting() used when trx is in scope — no auto-fix
      code: `async function f(trx) { await Model.query(trx).where("id", 1).transacting(trx); }`,
      errors: [{ messageId: "preferTransactionOption" }],
    },
    {
      // .transacting() in nested callback — $query gets fixed, transacting has no fix
      code: `async function save(trx) { items.map((item) => item.$query().transacting(trx)); }`,
      output: `async function save(trx) { items.map((item) => item.$query(trx).transacting(trx)); }`,
      errors: [
        { messageId: "preferTransactionOption" },
        { messageId: "missingTrxInstanceQuery" },
      ],
    },
    {
      // $fetchGraph with spread but no explicit transaction key
      code: `async function f(trx) { await item.$fetchGraph(expr, { ...opts }); }`,
      output: `async function f(trx) { await item.$fetchGraph(expr, { transaction: trx, ...opts }); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // class method without trx forwarded
      code: `class Repo { async save(trx) { await Model.query().findById(1); } }`,
      output: `class Repo { async save(trx) { await Model.query(trx).findById(1); } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .bindKnex().query() without trx — trx available in scope
      code: `async function save(knex, trx) { await Model.bindKnex(knex).query().findById(1); }`,
      output: `async function save(knex, trx) { await Model.bindKnex(knex).query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .knex().query() without trx — trx available in scope
      code: `async function save(knex, trx) { await Model.knex(knex).query().insert(data); }`,
      output: `async function save(knex, trx) { await Model.knex(knex).query(trx).insert(data); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .bindKnex().query() with wrong variable — trx not forwarded (no auto-fix for replacement)
      code: `async function save(knex, trx) { await Model.bindKnex(knex).query(knex).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // .transacting() on Model.bindKnex(knex).query() — no auto-fix
      code: `async function f(trx) { await Model.bindKnex(knex).query(trx).where("id", 1).transacting(trx); }`,
      errors: [{ messageId: "preferTransactionOption" }],
    },
    {
      // .transacting() on .$fetchGraph() chain — fetchGraph gets fixed, transacting has no fix
      code: `async function f(trx) { await item.$fetchGraph(expr).transacting(trx); }`,
      output: `async function f(trx) { await item.$fetchGraph(expr, { transaction: trx }).transacting(trx); }`,
      errors: [
        { messageId: "preferTransactionOption" },
        { messageId: "missingTrxFetchGraph" },
      ],
    },
    {
      // multiple errors in the same function body
      code: `function f(trx) { Model.query().findById(1); Other.query().findById(2); }`,
      output: `function f(trx) { Model.query(trx).findById(1); Other.query(trx).findById(2); }`,
      errors: [
        { messageId: "missingTrxQuery" },
        { messageId: "missingTrxQuery" },
      ],
    },
    {
      // trx from const declaration — should be flagged
      code: `async function save() { const trx = await getTransaction(); Model.query().findById(1); }`,
      output: `async function save() { const trx = await getTransaction(); Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // trx from let declaration — should be flagged
      code: `async function save() { let trx; trx = await getTransaction(); Model.query().findById(1); }`,
      output: `async function save() { let trx; trx = await getTransaction(); Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // trx from const inside try block — should be flagged
      code: `async function save() { try { const trx = await getTransaction(); Model.query().findById(1); } catch(e) {} }`,
      output: `async function save() { try { const trx = await getTransaction(); Model.query(trx).findById(1); } catch(e) {} }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // this.query() without trx in static model method
      code: `class Repo { static async save(trx) { await this.query().findById(1); } }`,
      output: `class Repo { static async save(trx) { await this.query(trx).findById(1); } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // trx in array destructuring — not forwarded
      code: `function f([trx]) { Model.query().findById(1); }`,
      output: `function f([trx]) { Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // trx as rest parameter — not forwarded
      code: `function f(...trx) { Model.query().findById(1); }`,
      output: `function f(...trx) { Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // $fetchGraph with empty object — no transaction property
      code: `async function f(trx) { await item.$fetchGraph(expr, {}); }`,
      output: `async function f(trx) { await item.$fetchGraph(expr, { transaction: trx }); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // knex.transaction() callback — trx not forwarded
      code: `async function run() { await knex.transaction(async (trx) => { await Model.query().findById(1); }); }`,
      output: `async function run() { await knex.transaction(async (trx) => { await Model.query(trx).findById(1); }); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // for...of loop with trx in outer scope — not forwarded
      code: `async function f(trx) { for (const item of items) { await Model.query().findById(item.id); } }`,
      output: `async function f(trx) { for (const item of items) { await Model.query(trx).findById(item.id); } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // this.$query() without trx in instance method
      code: `class Repo { async save(trx) { await this.$query().patch(data); } }`,
      output: `class Repo { async save(trx) { await this.$query(trx).patch(data); } }`,
      errors: [{ messageId: "missingTrxInstanceQuery" }],
    },
    {
      // trx destructured from object in function body — not forwarded
      code: `async function save() { const { trx } = await getTransaction(); Model.query().findById(1); }`,
      output: `async function save() { const { trx } = await getTransaction(); Model.query(trx).findById(1); }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // catch (trx) — not forwarded
      code: `async function save() { try { doStuff(); } catch (trx) { Model.query().findById(1); } }`,
      output: `async function save() { try { doStuff(); } catch (trx) { Model.query(trx).findById(1); } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // for...of declaring trx — not forwarded
      code: `async function save() { for (const trx of transactions) { Model.query().findById(1); } }`,
      output: `async function save() { for (const trx of transactions) { Model.query(trx).findById(1); } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // deeply nested scope chain (3 levels) — trx not forwarded
      code: `function outer(trx) { function middle() { function inner() { Model.query().findById(1); } } }`,
      output: `function outer(trx) { function middle() { function inner() { Model.query(trx).findById(1); } } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // trx in switch case body — not forwarded
      code: `async function f(trx) { switch (action) { case "save": Model.query().findById(1); break; } }`,
      output: `async function f(trx) { switch (action) { case "save": Model.query(trx).findById(1); break; } }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
    {
      // $fetchGraph with non-spread existing properties — no transaction key
      code: `async function f(trx) { await item.$fetchGraph(expr, { allowRefs: true }); }`,
      output: `async function f(trx) { await item.$fetchGraph(expr, { transaction: trx, allowRefs: true }); }`,
      errors: [{ messageId: "missingTrxFetchGraph" }],
    },
    {
      // ternary expression containing .query() — should be flagged
      code: `function f(trx) { const result = cond ? Model.query().findById(1) : null; }`,
      output: `function f(trx) { const result = cond ? Model.query(trx).findById(1) : null; }`,
      errors: [{ messageId: "missingTrxQuery" }],
    },
  ],
});
