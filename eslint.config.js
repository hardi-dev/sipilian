import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/drizzle/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.worktrees/**",
      "**/node_modules/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    plugins: {
      "@stylistic": stylistic,
      "simple-import-sort": simpleImportSort,
      jsdoc,
      sonarjs,
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "packages/*/vitest.config.ts",
            "packages/*/drizzle.config.ts",
            "eslint.config.js",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      jsdoc: { mode: "typescript" },
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      "sonarjs/cognitive-complexity": ["error", 10],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeAnnotation > TSTypeLiteral",
          message: "Inline object types are banned. Extract a named interface/type.",
        },
        {
          selector: "TSTypeAnnotation > TSUnionType > TSLiteralType",
          message: "Inline literal unions are banned. Extract a named type.",
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        {
          selector: "variable",
          modifiers: ["const", "exported"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
        { selector: "objectLiteralProperty", format: null },
        { selector: "import", format: ["camelCase", "PascalCase"] },
      ],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "error",
        { max: 20, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      complexity: ["error", 10],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: false,
          require: { FunctionDeclaration: true, MethodDefinition: true },
          contexts: ["VariableDeclarator > ArrowFunctionExpression"],
        },
      ],
      "jsdoc/no-types": "error",
      "jsdoc/check-alignment": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": ["error", { typed: true }],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns-type": "off",
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: "directive", next: "*" },
        { blankLine: "any", prev: "directive", next: "directive" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        { blankLine: "always", prev: "*", next: "return" },
        {
          blankLine: "always",
          prev: "*",
          next: ["if", "for", "while", "switch", "try", "function", "class"],
        },
        {
          blankLine: "always",
          prev: ["if", "for", "while", "switch", "try", "function", "class"],
          next: "*",
        },
      ],
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@sipilian/db", message: "core must stay pure: no DB imports." },
            { name: "drizzle-orm", message: "core must stay pure: no DB imports." },
            {
              name: "@neondatabase/serverless",
              message: "core must stay pure: no DB imports.",
            },
            { name: "react", message: "core must stay UI-free." },
            { name: "react-native", message: "core must stay UI-free." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "core must be deterministic: inject randomness as a parameter.",
        },
        {
          object: "Date",
          property: "now",
          message: "core must be deterministic: inject the current time as a parameter.",
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: "core must be deterministic: no timers." },
        { name: "setInterval", message: "core must be deterministic: no timers." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeAnnotation > TSTypeLiteral",
          message: "Inline object types are banned. Extract a named interface/type.",
        },
        {
          selector: "TSTypeAnnotation > TSUnionType > TSLiteralType",
          message: "Inline literal unions are banned. Extract a named type.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "core must be deterministic: pass time in; don't call new Date() for the current time.",
        },
      ],
    },
  },
  {
    files: ["packages/db/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "db layer must stay UI-free." },
            { name: "react-native", message: "db layer must stay UI-free." },
            {
              name: "@neondatabase/serverless",
              message:
                "Only packages/db/src/client.ts may construct the Neon connection; import the shared db elsewhere.",
            },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/db/src/client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "db layer must stay UI-free." },
            { name: "react-native", message: "db layer must stay UI-free." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/db/src/schema/**/*.ts"],
    rules: {
      "sonarjs/no-duplicate-string": "off",
    },
  },
  {
    files: ["packages/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "api must stay UI-free." },
            { name: "react-native", message: "api must stay UI-free." },
            {
              name: "@sipilian/auth",
              message: "api must not depend on auth; userId comes via ctx.",
            },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/auth/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react-native", message: "auth: react-native only in the expo client file." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/auth/src/server.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "server.ts must stay UI-free." },
            { name: "react-native", message: "server.ts must stay UI-free." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["**/vitest.config.ts", "**/drizzle.config.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-clear-text-protocols": "off",
      "no-restricted-properties": "off",
      "no-restricted-globals": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-useless-default-assignment": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "jsdoc/require-jsdoc": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-clear-text-protocols": "off",
      "no-restricted-properties": "off",
      "no-restricted-globals": "off",
    },
  },
  prettier,
);
