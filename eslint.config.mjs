import tseslint from "typescript-eslint";
export default tseslint.config(...tseslint.configs.recommended, {
  files: ["src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts"],
  rules: { "@typescript-eslint/no-explicit-any": "off" },
  ignores: [".next/**", "node_modules/**", "coverage/**"],
});
