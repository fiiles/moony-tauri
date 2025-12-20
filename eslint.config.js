import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores - including vendor shadcn ui components
  { ignores: ['dist', 'node_modules', 'src-tauri/target', 'scripts', 'src/components/ui'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  // TypeScript/React files
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    rules: {
      // Use recommended rules but override specific ones
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Downgrade setState in effect to warning (existing code uses this pattern)
      'react-hooks/set-state-in-effect': 'warn',
      // Warn on 'any' types to encourage proper typing
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable default unused-vars, use plugin instead for auto-fix
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // React refresh rules for Vite
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow empty functions (common in event handlers)
      '@typescript-eslint/no-empty-function': 'off',
      // Allow case declarations (existing code uses this)
      'no-case-declarations': 'warn',
    },
  },
  // Shared library files (may use let for mutable exports)
  {
    files: ['shared/**/*.ts'],
    rules: {
      'prefer-const': 'off',
    },
  },
  // Config files that use require()
  {
    files: ['*.config.ts', '*.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
