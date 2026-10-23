import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache override: the app does not use ISR, so no R2 cache bucket is needed.
export default defineCloudflareConfig({});
