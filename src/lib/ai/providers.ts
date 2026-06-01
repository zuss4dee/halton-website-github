import { createDeepSeek } from "@ai-sdk/deepseek";

const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

if (!apiKey) {
  console.error("CRITICAL: Missing VITE_DEEPSEEK_API_KEY in environment variables.");
}

export const deepseek = createDeepSeek({
  apiKey: apiKey ?? "",
});
