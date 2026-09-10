/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "ui/app/data/**/*.ts",
    "api/**/*.function.ts",
    "!**/*.d.ts",
  ],
  roots: ["<rootDir>/tests"],
  testPathIgnorePatterns: ["<rootDir>/tests/e2e/"],
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tests/tsconfig.json" }],
  },
};
