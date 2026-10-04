# Lab — Current Phase

## Tools

先保留现在已有的 Tools，不急着删。

接下来做：
- Markdown Preview
- JSON Preview

## Random

开始做一些没有实用目的、但是好看、酷炫、有互动性的东西。

方向：
- 跟随鼠标移动的 interactive website
- 各种视觉特效
- 重点是美观、酷炫、好玩
- 不需要实用

## Inspiration

可以参考：
- Cursor / Mouse Trail
- Particles
- Gooey Cursor
- Mouse-following distortion
- Interactive Dot Grid
- Gravity Mouse Trail

Random 先从这种 visual experiment 开始。

---

## Decisions and tasks

Approved 1 Oct 2026. Your plan above: keep the tools there are, add Markdown Preview and JSON Preview, and start on visual experiments that follow the mouse. It changes two things in the V1 plan ([lab-brief.md](lab-brief.md)), with your OK: a JSON tool comes in (the brief had left it for later); and QR code, the image tools and Compare Text wait. The experiments were first built as Random's content. On 2 Oct, after your test, they became **Effects**, a Lab section of their own, because Random is something else: one click that takes you to anything on the site (a post, a tool, a game). Random isn't built yet ("don't do Random first"), so it stays "coming soon" as in V1.

- **D15. Order:** Markdown Preview, JSON Preview, then Random. One task at a time, as before (D12).
- **D16. Markdown is read by micromark with its GitHub add-on** (both MIT): the engine Astro already installs, listed in `package.json` so the tool doesn't lean on Astro's own copy. No new download. HTML typed into the Markdown shows as text and never runs.
- **D17. JSON Preview reads JSON with its own small reader**, not the browser's, so every browser gives the same plain error with its line and column (Safari gives no position), and numbers and the order of keys show exactly as written.
- **D18. Effects is a section of the Lab home, one page per effect at `/lab/effect/<name>/`**, like the games: no gallery page, and "‹ Lab" goes back to the section. (Changed 2 Oct. They were first a gallery at `/random/` with pages at `/random/<name>/`; that was never published, so no old address needs forwarding.) The name is "Effects", not "CSS": they're drawn with JavaScript on a canvas.
- **D19. Effects follow the site's light and dark theme**, drawing with the topic colours. Canvas only, written from scratch, no packages, each loaded only on its own page. A finger works like the mouse; they drift gently when left alone; with "reduce motion" on, a still picture with a Play button.
- **D20. The first effect is the Interactive Dot Grid.** Then, one per task and each after your OK: Mouse Trail, Gravity Trail, Particles, Gooey Cursor, Distortion. (Built 1 Oct: Distortion is a net of lines bent in plain canvas like the rest, so the heavier graphics weren't needed.) Two more on 2 Oct, picked at your word from a web search for similar effects: Ripples (rings that spread where the pointer goes) and Compass (a field of needles that point at the pointer).
- **D21. JSON Preview shows the JSON one of two ways** (2 Oct): a "Tidy | Compact" switch at the preview's top right, Tidy at first, and one Copy button that copies what's showing. It replaced the two buttons, Copy tidy and Copy compact.

Tasks:

- **P1. Markdown Preview** (`/lab/markdown-preview/`), in a new "Preview" group on the Lab home. Type or paste Markdown and see it formatted beside it, live (under it on phones), looking like a Jack's Space post; tables, task lists and strikethrough work. Copy HTML and Clear. *Done when:* unit tests cover headings, lists, tables, links and typed HTML shown as text, and the page passes the window sizes in `check.md`.
- **P2. JSON Preview** (`/lab/json-preview/`). Paste JSON and see it tidy and coloured, with parts that fold. Broken JSON gets a plain message with line and column. A Tidy | Compact switch, Copy and Clear (D21). *Done when:* unit tests cover good and broken JSON, very large numbers, key order and deep nesting, and a 1 MB file doesn't freeze the page.
- **R1. Effects go live:** the Lab home's Effects section and the Dot Grid. *Done when:* it runs smoothly at every window size, touch works, both themes look right, and reduced motion is respected.
- **R2 onward. More effects**, one per task. Eight are built.
- **Random** (one click to anything on the site) waits for your word; `/random/` and the Lab home say it's coming.
