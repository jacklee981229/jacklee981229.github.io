// Following a train in Jack's Train World: the view zooms in until
// the whole train fills half the stage's shorter side, and keeps the middle of the train in the middle of the stage,
// even near the network's edge (where the page beyond it shows). A click picks the train nearest the
// pointer. src/worlds/trains.js draws with these; tested by tests/trains.test.js.
import { carsOf, placeOn } from './sim.js';

/** How much of the stage's shorter side a followed train fills. */
const SHARE = 0.5;

/**
 * @typedef {{ x: number, y: number, zoom: number }} View
 * The point of the network in the middle of the stage, and how far it's zoomed in (1 shows the whole network).
 * @typedef {import('./layout.js').Network} Network
 * @typedef {import('./sim.js').Train} Train
 */

/** The view of the whole network. @param {Network} network @returns {View} */
export const whole = (network) => ({ x: network.width / 2, y: network.height / 2, zoom: 1 });

/**
 * The view that follows a train whose front is `head` along its route.
 * @param {Network} network @param {Train} train @param {number} head @returns {View}
 */
export function viewOn(network, train, head) {
  const middle = placeOn(train, head - train.length / 2);
  return { x: middle.x, y: middle.y, zoom: Math.max(1, SHARE * Math.min(network.width, network.height) / network.trainLength) };
}

/**
 * The train whose body is nearest a point of the network, if it's no further than `slack` from it; null if none is.
 * @param {Train[]} trains @param {{ x: number, y: number }} point @param {number} slack @param {number} k
 * @param {(train: Train) => number} [headOf] where each train's front is (it moves on between steps)
 */
export function trainAt(trains, point, slack, k, headOf = (t) => t.head) {
  let best = null;
  let nearest = slack;
  for (const train of trains) {
    for (const car of carsOf(train, headOf(train), k)) {
      // The point in the car's own frame: along it and across it, and how far outside its body that is.
      const dx = point.x - car.x;
      const dy = point.y - car.y;
      const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) - car.length / 2;
      const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle)) - car.width / 2;
      const off = Math.hypot(Math.max(0, along), Math.max(0, across));
      if (off <= nearest) {
        nearest = off;
        best = train;
      }
    }
  }
  return best;
}
