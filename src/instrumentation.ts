import { TOP_CLOUD_BANNER } from "./lib/brand";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.info(`\n${TOP_CLOUD_BANNER}\n`);
  }
}
