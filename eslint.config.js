import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  ...tseslint.configs.recommended,
  {
    // Domínio puro: sem NestJS / MikroORM.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@nestjs/*", "@mikro-orm/*"] }],
    },
  },
);
