import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  { files: ["tests/**/*.mjs"], languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-unreachable": "error", "no-constant-condition": "error" } },
);
