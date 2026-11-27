import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,ts,tsx}"],
    languageOptions: { parser: tseslint.parser, ecmaVersion: "latest", sourceType: "module" },
    plugins: { "react-hooks": hooks },
    rules: { "no-unreachable": "error", "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }], "react-hooks/rules-of-hooks": "error" },
  },
];
