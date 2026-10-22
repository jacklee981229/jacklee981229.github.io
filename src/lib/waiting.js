// The three dots after words that wait for something ("Posting", "Loading the notes"), which take turns to brighten
// and never move (global.css draws them). Screen readers hear only the words. They go when the words are replaced.

/**
 * The dots, to put after the words.
 * @param {Document} [doc]
 * @returns {HTMLSpanElement}
 */
export function waitingDots(doc = document) {
  const dots = doc.createElement('span');
  dots.className = 'waiting-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) dots.append(doc.createElement('i'));
  return dots;
}

/**
 * Sets `el` to `words` and the dots.
 * @param {HTMLElement} el
 * @param {string} words
 */
export function sayWaiting(el, words) {
  el.replaceChildren(words, waitingDots(el.ownerDocument));
}
