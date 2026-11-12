import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "407293a83ac133b0b64dae86fb16bd07",
  worker: defineWorker({
    name: "cr-connect",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-12",
    observability: { enabled: true, redactQueryString: true, logs: { enabled: true, headSamplingRate: 0.1 }, traces: { enabled: true, headSamplingRate: 0.01 } },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ id: "a23f9414-4400-45d8-85e4-196e91781da7", name: "cr-connect" }),
      CR_BACKEND: bindings.text("d1"),
      APP_ORIGIN: bindings.secret(),
      RESEND_API_KEY: bindings.secret(),
      AUTH_EMAIL_FROM: bindings.secret(),
    },
  }),
});
