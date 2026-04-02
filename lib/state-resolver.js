const EVENT_STALE_MS = 10000;

const EVENT_TO_VISUAL = {
  tests_passed: "very_happy",
  commit: "very_happy",
  tests_failed: "error",
  error: "error",
  session_start: "session_start",
  session_end: "session_end",
  feed: "very_happy",
  pet: "happy",
  lint_run: "happy",
  working: "working",
  long_session: "working",
};

export function resolveVisualState(state) {
  const { buddy, event } = state;
  const { stats } = buddy;

  // Priority 1: Transient events (if fresh)
  if (event && event.timestamp) {
    const eventAge = Date.now() - new Date(event.timestamp).getTime();
    if (eventAge < EVENT_STALE_MS) {
      const visual = EVENT_TO_VISUAL[event.type];
      if (visual) return visual;
    }
  }

  // Priority 2: Critical — multiple stats below 20
  const lowStats = [stats.hunger, stats.happiness, stats.energy, stats.hygiene].filter(v => v < 20);
  if (lowStats.length >= 2) return "critical";

  // Priority 3: Individual low stats
  if (stats.energy < 20) return "energy_low";
  if (stats.hunger < 20) return "hunger_low";
  if (stats.happiness < 20) return "error";
  if (stats.hygiene < 20) return "hygiene_low";

  // Priority 4: Happy — all stats above 80
  const allHigh = [stats.hunger, stats.happiness, stats.energy, stats.hygiene].every(v => v > 80);
  if (allHigh) return "happy";

  // Priority 5: Default idle
  return "idle";
}
