# Jack's Space — Lab / Tools / Random Plan

## 0. Goal

Turn Jack's Space from a blog-only personal website into a small personal "Internet Home" by adding a lightweight Lab.

The Lab should feel:

- useful
- simple
- playful
- personal
- fast
- easy to expand later

The key idea is **not** to build a huge developer-tools website.

Instead:

> Build tiny tools that almost anyone can understand and use in a few seconds.

The first version should be completely compatible with a static GitHub Pages deployment and should not require:

- AI
- LLM API
- API keys
- server-side processing
- database
- authentication
- user accounts
- paid services
- recurring token usage

Where practical, data must stay in the browser.

---

# 1. Product Structure

Add a new top-level area:

```text
Jack's Space
├── Writing
├── Archives
├── About
│
└── Lab
    ├── Tools
    ├── Experiments
    └── Random (Coming Soon)
```

Important:

**Do not reorganize or rewrite the existing website unnecessarily.**

First inspect the existing repository and understand:

- framework
- routing
- component structure
- styling system
- content structure
- build/deploy setup
- existing conventions

Then integrate the Lab using the project's existing patterns.

Do not migrate frameworks just for this feature.

---

# 2. Lab Philosophy

The Lab has three concepts.

## 2.1 Tools

Small utilities that solve one simple problem.

Examples:

- convert an image
- count text
- clean text
- encode/decode a URL
- resize an image
- compress an image
- create a QR code

Each tool should have:

- one obvious purpose
- minimal UI
- immediate feedback
- no unnecessary settings
- clear copy/download/reset actions
- good mobile behavior

Avoid turning each page into a mini enterprise application.

---

## 2.2 Experiments

A permanent extension point for unusual things Jack may build later.

Examples in the future:

- tiny games
- visual toys
- interactive experiments
- weird UI experiments
- Easter eggs

### V1 requirement

The Experiments area does NOT need to be filled with many projects.

Create the structure and an attractive empty/placeholder state.

The area should communicate:

> "More experiments will appear here."

Do not invent a large list of fake experiments just to fill space.

---

## 2.3 Random

Random should eventually become a site-wide discovery mechanism.

However, **Random is explicitly NOT a V1 feature.**

Reason:

A good Random feature needs enough content to be interesting.

Before implementing Random behavior, Jack needs more random things to discover:

- old writing
- tools
- games
- experiments
- random thoughts
- easter eggs
- other small pages

Therefore V1 should only create a **Coming Soon / Incoming Random page**.

Suggested route:

```text
/random
```

Suggested purpose:

> A future "Surprise me" entry point for exploring Jack's Space.

The page should clearly communicate that Random is planned but not active yet.

Do not implement random selection logic in V1.

---

# 3. V1 Tools

Start small.

Target: **8–10 tools**, not 30+.

Prioritize tools that are understandable outside of programming.

## Tool 1 — URL Encoder / Decoder

Purpose:

- encode text for URLs
- decode URL-encoded text

UI:

```text
Input
[ textarea ]

[ Encode ] [ Decode ]

Output
[ textarea ]

[ Copy ]
```

Requirements:

- browser-only
- UTF-8 safe
- copy output
- swap input/output
- clear/reset
- friendly error handling

---

## Tool 2 — JPG → PNG

Purpose:

Convert a JPG/JPEG image to PNG directly in the browser.

Suggested flow:

```text
Drop image here
or
[ Choose image ]

Preview

[ Convert to PNG ]

[ Download PNG ]
```

Requirements:

- use browser APIs where practical
- no upload to a server
- preview before download
- preserve dimensions
- sensible default filename
- support drag & drop
- work on mobile file picker
- handle invalid file types gracefully

Possible implementation:

- File API
- Blob
- Canvas
- `canvas.toBlob()`

Do not overbuild it.

---

## Tool 3 — Image Resizer

Purpose:

Resize an image quickly.

UI should expose only the useful controls:

- width
- height
- lock aspect ratio
- output format
- preview
- download

Requirements:

- browser-only
- no server upload
- original image remains untouched
- preserve aspect ratio by default
- show original dimensions
- show output dimensions

---

## Tool 4 — Image Compressor

Purpose:

Reduce image file size.

UI:

```text
Choose image

Quality
[ slider ]

Original size
Compressed size
Estimated reduction

[ Download ]
```

Keep the UX simple.

Do not attempt advanced compression engineering in V1.

Use browser-supported canvas/image APIs where practical.

Clearly label that compression may change image quality.

---

## Tool 5 — QR Code Generator

Purpose:

Turn text or a URL into a QR code.

Use cases:

- website link
- Wi-Fi information (plain text/manual format)
- message
- contact text

UI:

```text
Text or URL
[ textarea ]

Size
[ small / medium / large ]

[ Generate ]

      QR CODE

[ Download PNG ]
```

Requirements:

- browser-only if the chosen library supports it
- no account
- no API key
- download image
- mobile friendly

Keep styling simple.

---

## Tool 6 — Word / Character Counter

Purpose:

Count text.

Show:

- characters
- characters without spaces
- words
- lines
- paragraphs

Optional:

- estimated reading time

The main result should appear instantly while typing.

This should feel like a "drop text here and immediately know the answer" utility.

---

## Tool 7 — Text Cleaner

Purpose:

Clean messy copied text.

Useful operations:

- remove leading/trailing spaces
- collapse repeated spaces
- remove empty lines
- normalize line breaks
- trim every line
- optionally remove duplicate blank lines

UI:

```text
Input
[ textarea ]

Cleaning options
☐ Trim lines
☐ Remove empty lines
☐ Collapse repeated spaces
☐ Normalize line breaks

Output
[ textarea ]

[ Copy ]
```

Keep the number of options limited.

---

## Tool 8 — Case Converter

Support common transformations:

- UPPERCASE
- lowercase
- Title Case
- Sentence case
- camelCase
- PascalCase
- snake_case
- kebab-case

For general users, the first four should be visually easiest to access.

Developer-oriented formats can sit underneath.

---

## Tool 9 — Timestamp Converter

Keep this because it is tiny and useful for technical work.

Support:

- Unix timestamp → readable date
- readable date → Unix timestamp

Show both:

- seconds
- milliseconds

Default to the user's local timezone.

Provide a copy button.

---

## Tool 10 — Text Diff

Purpose:

Compare two pieces of text.

UI:

```text
Original
[ textarea ]

Changed
[ textarea ]

[ Compare ]

Result
```

Highlight:

- added text
- removed text
- changed lines

Do not build a full Git diff engine.

The target is a simple "what changed between these two texts?" utility.

---

# 4. Tools That Are Deliberately Deferred

Do NOT add these to V1 unless there is a strong reason later:

- PDF merger
- PDF splitter
- PDF → image
- image → PDF
- PNG → JPG
- HEIC conversion
- WebP conversion
- JSON formatter
- JWT decoder
- Regex tester
- SQL formatter
- YAML converter
- Cron expression builder
- hash tools
- developer-only encoding tools
- image background removal
- OCR
- AI tools

These can become future Lab modules.

The converter concept should eventually be expandable, but the first release should stay tiny.

---

# 5. Converter Architecture

Although V1 only needs a few image conversions, design the tools so future converters can be added without rewriting the Lab.

Potential future structure:

```text
Converters
├── JPG → PNG
├── PNG → JPG
├── WebP → PNG
├── PNG → WebP
├── HEIC → JPG
├── Image → PDF
└── PDF → Image
```

However:

**Do not implement the full converter suite now.**

Build one or two very small tools first and make the underlying component patterns reusable.

---

# 6. Common Tool UX

Every tool should follow a shared pattern.

## Desktop

```text
Tool title
Short explanation

Input area
↓
Action
↓
Result

Utility actions
Copy / Download / Reset
```

## Mobile

No complicated side-by-side layout unless genuinely useful.

Prefer:

```text
Input
↓
Action
↓
Preview / Result
↓
Download / Copy
```

---

# 7. Shared Components

Create reusable components instead of custom-building every tool.

Suggested components:

```text
ToolPage
ToolHeader
ToolCard
ToolInput
ToolOutput
ToolActions
CopyButton
DownloadButton
ResetButton
FileDropzone
ImagePreview
FileInfo
EmptyState
ComingSoon
```

A shared tool shell should make it easy to add:

```text
new-tool/
  page
  logic
  tests (if needed)
```

without copying large chunks of UI.

---

# 8. Tool Registry

Use a central registry/configuration structure if it fits the existing project architecture.

Example concept:

```ts
{
  slug: "jpg-to-png",
  title: "JPG to PNG",
  description: "Convert a JPG image to PNG in your browser.",
  category: "image",
  status: "active"
}
```

This makes it easier later to:

- display cards
- search tools
- add categories
- add "coming soon" tools
- generate navigation
- support Random

Do not force a new architecture if the existing project has a better established pattern.

---

# 9. Lab Homepage

The Lab homepage should not look like a generic SaaS dashboard.

It should still feel like Jack's Space.

Suggested structure:

```text
🧪 Jack's Lab

Tiny useful things, random things,
and things I built because I felt like it.

[ Tools ]
[ Experiments ]
[ Random — Coming Soon ]

----------------------------------

TOOLS

[ JPG → PNG ]
[ Resize Image ]
[ Compress Image ]
[ QR Code Generator ]
[ Word Counter ]
[ Text Cleaner ]
[ Case Converter ]
[ URL Encoder ]
[ Timestamp ]
[ Text Diff ]

----------------------------------

EXPERIMENTS

Coming later...

----------------------------------

RANDOM

Not ready yet.

I'm still collecting enough
random things to make this fun.

[ Coming Soon ]
```

The exact visual implementation should follow the existing Jack's Space design language.

Do NOT make Lab look like a completely unrelated website.

---

# 10. Random Coming Soon Page

Create:

```text
/random
```

V1 behavior:

- informational only
- no random engine
- no fake content
- no unnecessary API

Possible copy:

> Random is coming.
>
> There isn't enough stuff here yet.
> I'm collecting more.

Potential button:

```text
[ Back to the Lab ]
```

Later this page can evolve into the real Random system without changing its URL.

---

# 11. Accessibility

All tools must be usable with:

- keyboard
- mouse
- touch

Requirements:

- proper labels
- visible focus states
- buttons with meaningful names
- sufficient text contrast
- no essential functionality hidden behind hover
- accessible error messages
- mobile tap targets

---

# 12. Privacy

For every tool that processes user files/text:

Prefer client-side processing.

Where possible, explicitly communicate:

> "Your file stays in your browser."

Never silently upload user files.

No analytics payload should contain user input.

Do not send tool input to third-party APIs.

---

# 13. Performance

The site is a personal static website.

Do not turn the Lab into a heavy application.

Requirements:

- lazy-load heavy libraries
- do not ship unnecessary libraries to every page
- code-split tool-specific dependencies
- keep the Lab homepage lightweight
- only load image-processing code on image-tool pages
- prefer native browser APIs where sufficient

---

# 14. Mobile

Mobile is important because tools such as:

- JPG → PNG
- Image Resize
- Image Compress
- QR Generator
- Text Cleaner

are potentially useful from a phone.

Test:

- iPhone Safari
- Android Chrome
- desktop Chrome

At minimum, the following must work on mobile:

- file picker
- image preview
- conversion
- download/share flow where supported
- textarea input
- copy buttons

---

# 15. Error Handling

Avoid technical error messages such as:

```text
DOMException
TypeError
CanvasRenderingContext2D...
```

Users should see:

> This file couldn't be opened.

or:

> Something went wrong. Please try another file.

For developer-oriented tools, a detailed error can optionally be expandable.

---

# 16. Naming / Tone

Avoid corporate SaaS language.

Prefer:

```text
JPG to PNG
Resize Image
Compress Image
Count Words
Clean Text
Make a QR Code
Encode URL
Convert Timestamp
Compare Text
```

Avoid:

```text
Advanced Image Transformation Suite
Universal Text Processing Utility
Developer Productivity Toolkit
```

Jack's Lab should feel personal and approachable.

---

# 17. Search / Navigation

V1 does not need a full command palette.

However, structure the Lab so a simple tool search/filter can be added later.

Possible future:

```text
Search tools...

[ image ] [ text ] [ converter ] [ utility ]
```

Do not build complex filtering unless the number of tools justifies it.

---

# 18. Easter Eggs

Do not add a large Easter-egg system in V1.

Leave room for future tiny additions.

Examples for later:

- Konami code
- secret page
- weird button
- unexpected animation
- hidden experiment

The principle:

> Easter eggs should be discovered, not advertised.

---

# 19. Future Random System

When the site has enough content, Random can select from:

```text
Writing
Games
Tools
Experiments
Thoughts
Photos
Easter eggs
Other pages
```

Possible future behavior:

```text
/random
    ↓
Pick something
    ↓
"You got..."
    ↓
[ Open it ]
```

Do not implement the selection engine until there is enough content to make it worthwhile.

---

# 20. V1 Scope

### Must Have

- Lab landing page
- Tools section
- 8–10 small tools
- shared tool UI patterns
- browser/client-side processing where possible
- responsive/mobile UI
- `/random` Coming Soon page
- Experiments placeholder
- navigation integration
- GitHub Pages compatible build

### Should Have

- copy buttons
- download buttons
- reset buttons
- drag & drop for image tools
- friendly validation/errors
- local-only privacy messaging for file tools
- consistent empty states

### Must NOT Have in V1

- AI
- API keys
- backend
- database
- login
- analytics tied to user input
- giant tool catalog
- WebGL
- 3D effects
- unnecessary animations
- full random engine
- complete converter suite

---

# 21. Recommended Implementation Order

## Phase 1 — Foundation

1. Inspect existing project
2. Identify existing routing/layout/component conventions
3. Add Lab route
4. Add shared Lab layout
5. Add shared ToolPage components
6. Add tool registry if appropriate
7. Add Random Coming Soon page
8. Add Experiments placeholder

## Phase 2 — Tiny Tools

Implement in this order:

1. Word / Character Counter
2. Case Converter
3. URL Encoder / Decoder
4. Timestamp Converter
5. QR Code Generator
6. JPG → PNG
7. Image Resizer
8. Image Compressor
9. Text Cleaner
10. Text Diff

This order intentionally starts with the easiest tools to validate the shared patterns before touching image processing.

## Phase 3 — Polish

- mobile testing
- keyboard accessibility
- copy/download UX
- error states
- page metadata
- loading states
- empty states
- consistency pass
- performance pass

## Phase 4 — Ship

- production build
- test GitHub Pages routing
- verify refresh/deep-link behavior
- verify mobile file tools
- verify all download flows
- verify no accidental server/API dependency

---

# 22. Acceptance Criteria

The Lab is ready for V1 when:

- A user can open the Lab and immediately understand what it is.
- A non-developer can use the main tools without instructions.
- The image tools do not upload files to a server.
- The site remains static-host friendly.
- Every tool has a consistent visual language.
- Mobile users can use the core tools.
- `/random` exists but intentionally says it is coming later.
- Experiments has a place to grow without requiring fake content.
- Adding a new small tool later is straightforward.
- The Lab feels like part of Jack's Space, not a separate SaaS product.

---

# 23. Guiding Principle

The Lab should follow one rule:

> **Small enough to build in an evening. Useful enough that someone bookmarks it.**

And another:

> **Do fewer things, but make every one of them pleasant to use.**

The goal is not to compete with large tool websites.

The goal is for someone visiting Jack's Space to think:

> "Oh, this is actually useful."

and then:

> "Wait, what else is on this site?"

---

## Decisions and tasks

Approved 29 Sep 2026. The brief above says what the Lab is, its tools, and what V1 must not have. This part adds only how it fits this site, the decisions and the tasks.

**How it fits:** pages `/lab/` (the Lab home: Tools, Experiments and a Random teaser), `/lab/<tool>/` (one per tool) and `/random/` (coming soon). "Lab" joins the menu: Home, Writing, Archives, Lab, About. `/lab/` and `/random/` are reserved, so no post can take them. One tool list in `src/lib/tools.js` feeds the Lab home, each tool's heading and the sitemap. One shared tool frame (back link, name, description, "stays in your browser" note) plus only the shared pieces the tools use. Tool rules live in plain JavaScript with unit tests; canvas, clipboard and downloads are checked in headless Edge. Each page loads only its own script. Tools keep your text colour (colour means topic on this site) and use the names from the brief.

**Defaults:** tool addresses `/lab/count-words/`, `/lab/change-case/`, `/lab/encode-url/`, `/lab/convert-timestamp/`, `/lab/clean-text/`, `/lab/qr-code/`, `/lab/jpg-to-png/`, `/lab/resize-image/`, `/lab/compress-image/`, `/lab/compare-text/`. Experiments is a section on the Lab home. `/random/` says it's coming, with a "Back to the Lab" button, and stays out of the menu and the sitemap. Tools stay out of site search for now. A flask icon instead of the 🧪 emoji. Clean Text moves up to the other text tools. Tool input never goes into the page address.

**Differences from the brief:** fewer shared components than it lists (only what the tools use). Real iPhone Safari and Android phones can't be tested on this PC: I test with phone emulation, and TESTING.md lists phone steps for you. Very large iPhone photos can go over Safari's image-size limit (about 16 megapixels); the image tools say so.

- **D10. QR codes: the `qrcode-generator` package** (MIT, no dependencies), loaded only on the QR page.
- **D11. Experiments shows your two games**, Play 2048! and Play Catch the Cat!, which stay hidden everywhere else.
- **D12. One Lab task at a time**, L1 first, starting with a mockup.
- **D13. Most Popular counts come from GoatCounter** (approved 30 Sep): free for personal sites, no cookies. busuanzi can't give other pages' counts without adding a view to each. Jack made the account (1 Oct, `jacklee981229.goatcounter.com`, public counts switched on); its script loads only on the live site, like busuanzi, and counts every page. Changed on 1 Oct, with Jack's OK: the top 4 is worked out while the site is built, on every publish and once a day, not in each visitor's browser, so it shows at once, nothing jumps and ad-blockers can't hide it. It sits at the top of the Lab home, shows no numbers, and appears once four Lab items have been visited at all.
- **D14. Games live at `/lab/game/<name>/`** (approved 30 Sep): `/lab/game/2048/`, `/lab/game/catch-the-cat/`, `/lab/game/snake/` and `/lab/game/blocks/`. The old `/game_1/` and `/game_2/` forward to the new addresses. Posts stay at `/<folder>/`: moving them would restart every post's view count and turn every old link into a forwarding hop.

Tasks:

- **L1. Foundation, plus Count Words.** A mockup of the Lab home and a tool page for your OK, then the Lab home, the tool list, the shared frame, `/random/`, the Experiments section and the menu item, and the first tool, Count Words (characters, characters without spaces, words, lines, paragraphs and reading time, live as you type; Chinese counted properly). *Done when:* unit tests pass, the new pages pass the UI checks, and a post can't use `/lab/` or `/random/`.
- **L2. Text tools:** Change Case, Encode URL, Convert Timestamp, Clean Text. *Done when:* unit tests cover each rule (Unicode, broken % codes, seconds and milliseconds, local time and UTC, each cleaning option), copy, swap and reset work in headless Edge, and errors are plain words.
- **L3. Make a QR Code.** *Done when:* a link and a long message decode back correctly in the test, three sizes download as PNG, and text too long for a QR code gets a clear message.
- **L4. Image tools:** JPG to PNG, Resize Image, Compress Image, sharing the file drop area, preview, download and phone Share. *Done when:* a test photo converts at the same size, resize keeps proportions when locked, compression shows before and after sizes (and says so if the file grew), wrong files get a clear message, and the network log shows nothing uploaded.
- **L5. Compare Text.** *Done when:* unit tests cover added, removed and changed lines with word highlights, and very large inputs get a clear limit message instead of freezing.
- **L6. Finish.** A consistency and page-weight pass, and direct links checked on GitHub Pages; push when you say.

L3 to L6 are paused by phase 2 ([lab-phase-2.md](lab-phase-2.md)); their "Soon" cards stay on the Lab home.
