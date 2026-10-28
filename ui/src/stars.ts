/*
 * Shows the repo's GitHub star count in every [data-gh-stars] element and
 * reveals its surrounding .gh-count (which also holds the star icon).
 */
import { config } from "./config.ts";

export async function showStarCount(): Promise<void> {
  try {
    const res = await fetch(`https://api.github.com/repos/${config.repo}`);
    if (!res.ok) return;
    const repo = (await res.json()) as { stargazers_count?: number };
    if (!repo.stargazers_count) return;
    const count = repo.stargazers_count.toLocaleString();
    document.querySelectorAll<HTMLElement>("[data-gh-stars]").forEach((el) => {
      el.textContent = count;
      el.hidden = false;
      const wrap = el.closest<HTMLElement>(".gh-count");
      if (wrap) wrap.hidden = false;
    });
  } catch {
    /* the count is optional */
  }
}
