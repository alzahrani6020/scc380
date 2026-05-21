/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['./base', 'next/core-web-vitals'],
  env: {
    browser: true,
    node: true,
  },
};
