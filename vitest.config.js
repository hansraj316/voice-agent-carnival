import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.js'],
        globals: true,
        clearMocks: true,
        restoreMocks: true
    }
});
