import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createLLMRouter, MODEL_MAP } from "../lib/llm-router.js";

describe("MODEL_MAP", () => {
  it("maps call types to model IDs", () => {
    assert.ok(MODEL_MAP.ambient.includes("haiku"));
    assert.ok(MODEL_MAP.event.includes("haiku"));
    assert.ok(MODEL_MAP.chat.includes("sonnet"));
    assert.ok(MODEL_MAP.reflection.includes("opus"));
  });
});

describe("createLLMRouter", () => {
  it("calls anthropic.messages.create with correct model for ambient", async () => {
    let capturedArgs = null;
    const fakeClient = {
      messages: {
        create: mock.fn(async (args) => {
          capturedArgs = args;
          return { content: [{ type: "text", text: "A thought~" }] };
        }),
      },
    };
    const router = createLLMRouter(fakeClient);
    const result = await router.generate({ type: "ambient", system: "You are Kira.", user: "Generate a thought." });
    assert.equal(result, "A thought~");
    assert.ok(capturedArgs.model.includes("haiku"));
    assert.equal(capturedArgs.system, "You are Kira.");
  });

  it("uses messages array for chat type", async () => {
    let capturedArgs = null;
    const fakeClient = {
      messages: {
        create: mock.fn(async (args) => {
          capturedArgs = args;
          return { content: [{ type: "text", text: "Hey there!" }] };
        }),
      },
    };
    const router = createLLMRouter(fakeClient);
    const result = await router.generateChat({
      system: "You are Kira.",
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.equal(result, "Hey there!");
    assert.ok(capturedArgs.model.includes("sonnet"));
    assert.deepEqual(capturedArgs.messages, [{ role: "user", content: "Hello" }]);
  });

  it("returns empty string on API error", async () => {
    const fakeClient = {
      messages: { create: mock.fn(async () => { throw new Error("API down"); }) },
    };
    const router = createLLMRouter(fakeClient);
    const result = await router.generate({ type: "ambient", system: "test", user: "test" });
    assert.equal(result, "");
  });
});
