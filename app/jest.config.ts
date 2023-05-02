export default {
    preset: 'ts-jest/presets/default-esm',
    globals: {
        'ts-jest': {
          tsConfig: 'tsconfig.json',
          useESM: true,
        },
     },
};
