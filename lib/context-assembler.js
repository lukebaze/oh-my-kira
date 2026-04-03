import { composePersonalityPrompt } from "./personality.js";

function formatRecentEvents(events) {
  if (!events || events.length === 0) return "No recent events.";
  return events.map((e) => `- ${e.detail || e.type} (${e.type})`).join("\n");
}

function formatRecentThoughts(thoughts) {
  if (!thoughts || thoughts.length === 0) return "";
  return "\nRecent thoughts (do not repeat):\n" + thoughts.map((t) => `- "${t}"`).join("\n");
}

export function assembleAmbientPrompt({ buddy, sessionDurationMin, recentEvents, recentThoughts }) {
  const system = composePersonalityPrompt({
    name: buddy.name, personalitySeed: buddy.personalitySeed,
    archetypeScores: buddy.archetypeScores, stats: buddy.stats, stage: buddy.stage, xp: buddy.xp,
  });
  const timeOfDay = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const user = [
    `Session duration: ${sessionDurationMin} minutes`, `Time: ${timeOfDay}`, "",
    "Recent events:", formatRecentEvents(recentEvents), "",
    "Generate a short ambient thought (max 60 chars).",
    "It should feel natural, in-character, and aware of what's happening.",
    "Do not repeat recent thoughts.", formatRecentThoughts(recentThoughts),
  ].join("\n");
  return { system, user };
}

export function assembleEventPrompt({ buddy, sessionDurationMin, recentEvents, recentThoughts }, event) {
  const system = composePersonalityPrompt({
    name: buddy.name, personalitySeed: buddy.personalitySeed,
    archetypeScores: buddy.archetypeScores, stats: buddy.stats, stage: buddy.stage, xp: buddy.xp,
  });
  const timeOfDay = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const user = [
    `Session duration: ${sessionDurationMin} minutes`, `Time: ${timeOfDay}`, "",
    `Event just happened: ${event.type}`, `Detail: ${event.detail || "none"}`, "",
    "Recent events:", formatRecentEvents(recentEvents), "",
    "Generate a short reactive thought (max 60 chars).",
    "React to this event in-character. Be specific to the context if possible.",
    formatRecentThoughts(recentThoughts),
  ].join("\n");
  return { system, user };
}

export function assembleChatPrompt(
  { buddy, sessionDurationMin, recentEvents, recentThoughts, chatHistory, sessionSummaries, identityMemory },
  userMessage
) {
  let systemParts = [
    composePersonalityPrompt({
      name: buddy.name, personalitySeed: buddy.personalitySeed,
      archetypeScores: buddy.archetypeScores, stats: buddy.stats, stage: buddy.stage, xp: buddy.xp,
    }),
  ];
  const timeOfDay = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  systemParts.push(`\nSession duration: ${sessionDurationMin} minutes`);
  systemParts.push(`Time: ${timeOfDay}`);
  if (recentEvents && recentEvents.length > 0) {
    systemParts.push("\nRecent events:\n" + formatRecentEvents(recentEvents));
  }
  if (sessionSummaries && sessionSummaries.length > 0) {
    systemParts.push("\nRecent session history:\n" + sessionSummaries.map((s) => `- ${s}`).join("\n"));
  }
  if (identityMemory) {
    systemParts.push(
      "\nCoding patterns:" +
      `\n- Average session: ${identityMemory.avgSessionMin || "?"} min` +
      `\n- Peak coding hour: ${identityMemory.peakHour || "?"}`
    );
  }
  systemParts.push("\nYou are having a direct conversation. Respond in-character.",
    "Keep responses concise (1-3 sentences) unless asked for detail.");
  const system = systemParts.join("\n");
  const messages = [];
  if (chatHistory) {
    for (const turn of chatHistory) {
      messages.push({ role: turn.role === "buddy" ? "assistant" : "user", content: turn.message });
    }
  }
  messages.push({ role: "user", content: userMessage });
  return { system, messages };
}
