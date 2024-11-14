export default {
  files: [
    "src/**/*.spec.ts",
    "!src/**/*.compileerror.spec.ts"
  ],
  typescript: {
    rewritePaths: {
      "~src/": "dist/",
    },
    compile: false,
  },
  nodeArguments: ["--import=tsx"],
  utilizeParallelBuilds: false,
  serial: true,
};
