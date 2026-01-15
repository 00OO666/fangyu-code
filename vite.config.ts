import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
  ],

  // Use lightningcss for CSS processing (fixes Tailwind 4 unicode issues)
  css: {
    transformer: 'lightningcss',
  },

  // Path resolution
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. prefer port 5173, but auto-increment if occupied (prevents port conflicts)
  server: {
    port: 5173,
    strictPort: false,
    host: host || '127.0.0.1',
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 5174,
      }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Optimize dependencies (pre-bundle for faster dev startup)
  optimizeDeps: {
    include: [
      'lucide-react',
      'framer-motion',
      'react-markdown',
      'remark-gfm',
    ],
  },

  // Build configuration for code splitting and optimization
  build: {
    // Increase chunk size warning limit to 2000 KB
    chunkSizeWarningLimit: 2000,

    // Additional optimizations for smaller bundle size
    minify: "esbuild",
    target: "es2015",
    cssMinify: true,

    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // Vendor chunks
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-switch",
            "@radix-ui/react-popover",
          ],
          "icons-vendor": ["lucide-react"],
          "motion-vendor": ["framer-motion"],
          "editor-vendor": ["@uiw/react-md-editor"],
          "syntax-vendor": ["react-syntax-highlighter"],
          utils: ["clsx", "tailwind-merge"],
        },
      },
    },
  },

  // Web Worker support
  worker: {
    format: "es",
  },
}));
