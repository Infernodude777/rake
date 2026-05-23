export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Build daily aggregates from timestamped items grouped by day of week (last 7 days) */
export function buildDailyData(
  businesses: { createdAt: number }[],
  leads: { createdAt: number }[],
  websites: { createdAt: number }[],
) {
  const now = Date.now();
  const DAY_MS = 86_400_000;
  const counts: Record<string, { leads: number; websites: number; outreach: number }> = {};

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * DAY_MS);
    const key = DAYS[date.getDay()];
    counts[key] = { leads: 0, websites: 0, outreach: 0 };
  }

  businesses.forEach((b) => {
    if (now - b.createdAt < 7 * DAY_MS) {
      const key = DAYS[new Date(b.createdAt).getDay()];
      if (counts[key]) counts[key].outreach++;
    }
  });

  leads.forEach((l) => {
    if (now - l.createdAt < 7 * DAY_MS) {
      const key = DAYS[new Date(l.createdAt).getDay()];
      if (counts[key]) counts[key].leads++;
    }
  });

  websites.forEach((w) => {
    if (now - w.createdAt < 7 * DAY_MS) {
      const key = DAYS[new Date(w.createdAt).getDay()];
      if (counts[key]) counts[key].websites++;
    }
  });

  // Return in order starting from 7 days ago → today
  const today = new Date().getDay();
  const result: { name: string; leads: number; websites: number; outreach: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const idx = (today - i + 7) % 7;
    result.push({ name: DAYS[idx], ...counts[DAYS[idx]] });
  }
  return result;
}
