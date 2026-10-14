// Proves AI Gateway works locally: node --env-file-if-exists=.env.local scripts/ai-smoke.mjs
import { generateText } from "ai";

const model = process.env.MODEL_FAST || "anthropic/claude-haiku-5.5";
const result = await generateText({ model, prompt: "Reply with the single word: pong" });
console.log({ model, text: result.text, cost: result.providerMetadata?.gateway?.cost });
