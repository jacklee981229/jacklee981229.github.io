// How many days the site has been running, recounted in the visitor's browser (the pages are only rebuilt when
// something changes): every element with data-running-since="YYYY-MM-DD" gets the number.
export function showRunningDays() {
  document.querySelectorAll('[data-running-since]').forEach((el) => {
    const start = new Date(`${/** @type {HTMLElement} */ (el).dataset.runningSince}T00:00:00+08:00`).getTime();
    el.textContent = Math.floor((Date.now() - start) / 86400000).toLocaleString('en-US');
  });
}
