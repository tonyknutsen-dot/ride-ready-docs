import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      timeout: 60000,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode !== "development" && VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["pwa-icon.jpg", "favicon.ico", "app-logo.jpg"],
      manifest: {
        name: "Ride Ready Docs",
        short_name: "RideReady",
        description: "Complete operations management for amusement ride operators. Manage documents, safety checks, maintenance, and compliance.",
        theme_color: "#1a1a2e",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/overview",
        categories: ["business", "productivity", "utilities"],
        icons: [
          {
            src: "/pwa-icon.jpg",
            sizes: "192x192",
            type: "image/jpeg",
            purpose: "any"
          },
          {
            src: "/pwa-icon.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any"
          },
          {
            src: "/pwa-icon.jpg",
            sizes: "180x180",
            type: "image/jpeg",
            purpose: "any"
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/functions\//, /^\/rest\//],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2,webmanifest}"],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Navigation requests — NetworkFirst, fall back to cached app shell
          {
            urlPattern: ({request}) => request.mode === 'navigate',
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              networkTimeoutSeconds: 3,
            }
          },
          // Static assets (JS/CSS/fonts/images) — StaleWhileRevalidate
          {
            urlPattern: /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-assets-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          // Supabase REST API — network-first, fall back to cache
          {
            urlPattern: /^https:\/\/sbtldudgiskqfqqkrmaa\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Supabase Auth — network-only (tokens must be fresh)
          {
            urlPattern: /^https:\/\/sbtldudgiskqfqqkrmaa\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
          },
          // Supabase Storage (PDFs, images) — cache-first after first fetch
          {
            urlPattern: /^https:\/\/sbtldudgiskqfqqkrmaa\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Edge functions — network-only
          {
            urlPattern: /^https:\/\/sbtldudgiskqfqqkrmaa\.supabase\.co\/functions\/.*/i,
            handler: "NetworkOnly",
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
