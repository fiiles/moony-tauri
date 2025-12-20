module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", "node_modules"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react-refresh", "@typescript-eslint"],
  rules: {
    // Warn on 'any' types to encourage proper typing
    "@typescript-eslint/no-explicit-any": "warn",
    // Allow unused vars starting with underscore
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    // React refresh rules for Vite
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    // Allow empty functions (common in event handlers)
    "@typescript-eslint/no-empty-function": "off",
  },
};
