module.exports = {
  rules: [
    {
      validation: 'camelCase',
      patterns: ['*/**'],
    },
    {
      validation: 'PascalCase',
      patterns: ['src/reporters/*.ts'],
    },
    {
      validation: 'ignore',
      patterns: [
        '*/**/typings/*',
        '__tests__/**/*',
        'src/__image_snapshots__/**/*',
        'src/fixtures/**/*',
        'docker-compose.yml',
        '**/LICENSE.md',
        '**/README.md',
      ],
    },
  ],
};
