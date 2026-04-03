export const MODEL_MAP = {
  ambient: "claude-haiku-4-5-20251001",
  event: "claude-haiku-4-5-20251001",
  chat: "claude-sonnet-4-6",
  reflection: "claude-opus-4-6",
};

export function createLLMRouter(client) {
  async function generate({ type, system, user }) {
    const model = MODEL_MAP[type] || MODEL_MAP.ambient;
    try {
      const response = await client.messages.create({
        model, max_tokens: 150, system,
        messages: [{ role: "user", content: user }],
      });
      return response.content[0]?.text || "";
    } catch (err) {
      console.error(`[brain] LLM error (${type}):`, err.message);
      return "";
    }
  }

  async function generateChat({ system, messages }) {
    try {
      const response = await client.messages.create({
        model: MODEL_MAP.chat, max_tokens: 500, system, messages,
      });
      return response.content[0]?.text || "";
    } catch (err) {
      console.error("[brain] Chat LLM error:", err.message);
      return "";
    }
  }

  return { generate, generateChat };
}
