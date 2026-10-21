import { defineConfig } from 'vite';
import { defaultViteConfig } from 'markedit-vite';

// Set CI=1 to build dist/ without copying it into MarkEdit's scripts folder
export default defineConfig(defaultViteConfig({ copyDistFile: !process.env.CI }));
