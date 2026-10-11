// The sliding fill of every `.switch` (Switch.astro, the Collections tabs): one pill that glides to the chosen side.
// This only measures the sides into --pill-x-N and --pill-w-N on the switch; global.css picks the chosen side's pair
// with :has(), so a choice set by a page's own script (a look kept in this browser) moves the pill as well.
// Without this script, the chosen side is simply filled in.
export function slidePills() {
  for (const box of document.querySelectorAll<HTMLElement>('.switch')) {
    if (box.querySelector(':scope > .switch-pill')) continue;
    const sides = [...box.children] as HTMLElement[];
    const pill = document.createElement('span');
    pill.className = 'switch-pill still';
    pill.setAttribute('aria-hidden', 'true');
    const measure = () => {
      sides.forEach((side, i) => {
        box.style.setProperty(`--pill-x-${i + 1}`, `${side.offsetLeft}px`);
        box.style.setProperty(`--pill-w-${i + 1}`, `${side.offsetWidth}px`);
      });
    };
    measure();
    box.append(pill);
    // Placed at once on arrival, and again when the sides change size (fonts arriving, a phone's taller sides);
    // only a new choice glides.
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => frame = requestAnimationFrame(() => pill.classList.remove('still')));
    };
    settle();
    new ResizeObserver(() => {
      pill.classList.add('still');
      measure();
      settle();
    }).observe(box);
  }
}
