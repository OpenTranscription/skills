export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The release rules in .releaserc.json key off these exactly. A type outside
    // this list silently produces no release rather than an error at merge time.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
