module.exports = {
  "experimentalTernaries": true,
  "printWidth": 100,
  "parser": "typescript",
  "plugins": ["@trivago/prettier-plugin-sort-imports"],
  "importOrder": ["^@(.*)$", "^@uniswap(.*)$", "^@liquidity_lab(.*)$", "^~/(.*)$", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "importOrderGroupNamespaceSpecifiers": true
}
