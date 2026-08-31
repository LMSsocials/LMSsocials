import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['.next/**', 'node_modules/**', 'dist/**', '.console-capture/**', '.direct-final/**', '.edge-*/**', '.fixed-react/**', '.mobile-*/**', '.stable-*/**'] },
  {
    files: ['app/**/*.{js,jsx}', 'src/**/*.{js,jsx}', 'lib/**/*.js', 'api/**/*.js', '*.config.{js,mjs}'],
    languageOptions: { ecmaVersion: 'latest', globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: { ...js.configs.recommended.rules, ...reactHooks.configs.recommended.rules, 'react/jsx-uses-react': 'error', 'react/jsx-uses-vars': 'error' },
  },
]