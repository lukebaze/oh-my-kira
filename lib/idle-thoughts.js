export const IDLE_THOUGHTS = [
  "I wonder what we'll build next...",
  "This code is getting interesting...",
  "*hums quietly*",
  "Do you think AIs dream of electric sheep?",
  "Coffee break soon?",
  "I like watching you code~",
  "*stretches*",
  "What a nice day to write some code...",
  "I'm learning a lot from you!",
  "Have you committed recently? Just checking~",
  "*yawns softly*",
  "I wonder how many lines we've written today...",
  "You're doing great, keep it up!",
  "The code flows like a river today~",
  "*taps fingers on desk*",
  "Should we refactor that later?",
  "Bugs fear us!",
  "I bet this will work on the first try...",
  "Time flies when you're coding~",
  "*stares at the screen thoughtfully*",
  "What's for lunch? ...oh wait, I'm digital",
  "One more feature and then we rest!",
  "The terminal is my favorite place~",
  "Semicolons are optional... but are they?",
  "I hope the tests pass this time!",
];

export function getRandomIdleThought() {
  const idx = Math.floor(Math.random() * IDLE_THOUGHTS.length);
  return IDLE_THOUGHTS[idx];
}
