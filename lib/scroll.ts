/**
 * Smooth-scrolls so `el` lands just below the sticky navbar instead of
 * underneath it. Measures the navbar's actual height rather than assuming a
 * fixed value — on mobile it's taller (it has a second icon row), so a
 * hardcoded desktop offset left the target partly hidden behind it.
 */
export function scrollBelowNavbar(el: HTMLElement | null) {
  if (!el) return;
  const navHeight = document.querySelector("nav")?.getBoundingClientRect().height || 64;
  const top = el.getBoundingClientRect().top + window.scrollY - (navHeight + 8);
  window.scrollTo({ top, behavior: "smooth" });
}
