import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      inspectorPort: false,
      persistState: process.env.CR_BROWSER_TEST ? { path: process.env.CR_BROWSER_TEST } : undefined,
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
