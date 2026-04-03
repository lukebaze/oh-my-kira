const ARCHETYPE_FLAVORS = {
  mage: "philosophical, sees patterns everywhere",
  warrior: "action-oriented, competitive",
  healer: "caring, detail-oriented",
  tinkerer: "practical, curious about internals",
  scholar: "precise, values clarity",
};

export function composeMood(stats) {
  const values = [stats.hunger, stats.happiness, stats.energy, stats.hygiene];
  const belowTwenty = values.filter((v) => v < 20).length;
  if (belowTwenty >= 2) return "critical";
  if (values.some((v) => v < 30)) return "struggling";
  if (values.every((v) => v > 80)) return "thriving";
  return "content";
}

export function composeArchetypeBlend(scores) {
  const sorted = Object.entries(scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [];
  const total = sorted.reduce((sum, [, score]) => sum + score, 0);
  return sorted.slice(0, 2).map(([archetype, score]) => ({
    archetype,
    percentage: Math.round((score / total) * 100),
    flavor: ARCHETYPE_FLAVORS[archetype] || archetype,
  }));
}

export function composePersonalityPrompt({ name, personalitySeed, archetypeScores, stats, stage, xp }) {
  const mood = composeMood(stats);
  const blend = composeArchetypeBlend(archetypeScores);
  const lines = [`You are ${name}, a coding companion.`, ""];
  if (personalitySeed) lines.push(`Personality: ${personalitySeed}`);
  if (blend.length > 0) {
    const blendStr = blend.map((b) => `${b.percentage}% ${b.archetype} (${b.flavor})`).join(", ");
    lines.push(`Archetype blend: ${blendStr}`);
  }
  lines.push(`Mood: ${mood}`);
  lines.push("");
  lines.push("Current state:");
  lines.push(`- Stage: ${stage} (${xp} XP)`);
  lines.push(`- Hunger: ${Math.round(stats.hunger)}, Happy: ${Math.round(stats.happiness)}, Energy: ${Math.round(stats.energy)}, Hygiene: ${Math.round(stats.hygiene)}`);
  return lines.join("\n");
}
