# eslint-plugin-objection-trx

ESLint plugin that ensures trx is forwarded to Objection.js database calls

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `eslint-plugin-objection-trx`:

```sh
npm install eslint-plugin-objection-trx --save-dev
```

## Usage

In your [configuration file](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-file), import the plugin `eslint-plugin-objection-trx` and add `objection-trx` to the `plugins` key:

```js
import { defineConfig } from "eslint/config";
import objection-trx from "eslint-plugin-objection-trx";

export default defineConfig([
    {
        plugins: {
            objection-trx
        }
    }
]);
```

Then configure the rules you want to use under the `rules` key.

```js
import { defineConfig } from "eslint/config";
import objection-trx from "eslint-plugin-objection-trx";

export default defineConfig([
    {
        plugins: {
            objection-trx
        },
        rules: {
            "objection-trx/rule-name": "warn"
        }
    }
]);
```

## Configurations

<!-- begin auto-generated configs list -->

TODO: Run eslint-doc-generator to generate the configs list (or delete this section if no configs are offered).

<!-- end auto-generated configs list -->

## Rules

<!-- begin auto-generated rules list -->

TODO: Run eslint-doc-generator to generate the rules list.

<!-- end auto-generated rules list -->
