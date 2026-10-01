const COAUTHOR_PATTERN = /^\s*co-authored-by\s*:/im;

export const COMMIT_TYPES = ['feat', 'fix', 'chore', 'refactor', 'docs', 'perf', 'style', 'test', 'build', 'ci', 'env'];

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-coauthor': ({ raw }) => [
          !COAUTHOR_PATTERN.test(raw ?? ''),
          'commits não podem ter Co-authored-by',
        ],
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', COMMIT_TYPES],
    'subject-full-stop': [2, 'never', '.'],
    'no-coauthor': [2, 'always'],
  },
};
