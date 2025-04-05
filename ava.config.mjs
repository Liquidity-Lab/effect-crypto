export default {
  files: [
    "packages/*/src/**/*.spec.ts",
    "!packages/*/src/**/*.compileerror.spec.ts"
  ],
  typescript: {
    rewritePaths: {
    },
    compile: false,
  },
  nodeArguments: ["--import=tsx"],
  // TODO: Perhaps I need to implement something like this for NonceManager -> https://github.com/avajs/get-port/blob/main/source/index.ts#L24
  utilizeParallelBuilds: false,
  serial: true,
};
