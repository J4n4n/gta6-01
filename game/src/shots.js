// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real game forward from a fresh seeded world for a fixed number of steps,
// steered by an autopilot that follows the road graph, so the frame is what
// real play looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { driveToward } from './ai.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 16;
const CHASE_SECONDS = 6;
const MISSION_SECONDS = 5;

// Shortest route along the intersection grid, from the intersection nearest
// (fromX, fromY) to the one nearest (toX, toY). Breadth-first search.
function planRoute(city, fromX, fromY, toX, toY) {
  const start = city.nearestIntersection(fromX, fromY);
  const goal = city.nearestIntersection(toX, toY);
  const key = (n) => `${n.x},${n.y}`;
  const prev = new Map();
  prev.set(key(start), null);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === goal) break;
    for (const next of city.neighbours(node)) {
      if (!prev.has(key(next))) {
        prev.set(key(next), node);
        queue.push(next);
      }
    }
  }
  if (!prev.has(key(goal))) return [goal];
  const path = [];
  let current = goal;
  while (current) {
    path.unshift(current);
    current = prev.get(key(current));
  }
  return path;
}

// Drive the player car along a planned route, one intersection at a time.
function routeDriver(game, route) {
  let index = 1;
  return (g, dt) => {
    const car = g.player.car;
    if (!car) return;
    if (index >= route.length) return;
    const target = route[index];
    driveToward(car, target.x, target.y, dt, g.city, g.cars, 560);
    if (Math.hypot(car.x - target.x, car.y - target.y) < 70) index += 1;
  };
}

// Run the world forward `seconds`, stepping the traffic, the pedestrians, the
// police and the mission runner with it, so the staged scene is alive.
function simulate(game, seconds, drive) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive) drive(game, STEP);
    game.tickWorld(STEP, true);
  }
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * start: the title over a living city. drive: the player driving downtown.
 * chase: a three-star police chase. mission: on foot at the docks pickup.
 */
export function stageShot(name, game) {
  game.resetWorld(1);
  if (name === 'drive') {
    game.givePlayerCar('Sedan', '#d94f3d');
    game.player.car.x = 900;
    game.player.car.y = 2050;
    game.player.car.angle = -Math.PI / 2;
    game.mission.start();
    const route = planRoute(game.city, 900, 2050, 1500, 900);
    simulate(game, DRIVE_SECONDS, routeDriver(game, route));
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // A straight run north on avenue 2700: the player is fast, the cops are
    // on his tail, and the road stretches ahead. Short enough that the cops
    // (slower, but cutting the corners) are still in the frame.
    game.givePlayerCar('Coupe', '#e8c33d');
    game.player.car.x = 2700;
    game.player.car.y = 2100;
    game.player.car.angle = -Math.PI / 2;
    game.setWanted(3);
    game.mission.start();
    const route = planRoute(game.city, 2700, 2100, 2700, 300);
    simulate(game, CHASE_SECONDS, routeDriver(game, route));
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // The pickup at the docks, in a car: the subject is big enough to read,
    // the crate yard and the marker are in the frame.
    game.mission.jumpTo(1);
    game.mission.start();
    game.givePlayerCar('Sedan', '#d94f3d');
    game.player.car.x = 3300;
    game.player.car.y = 1500;
    game.player.car.angle = 0;
    simulate(game, MISSION_SECONDS, null);
    return { screen: 'play' };
  }
  simulate(game, START_SECONDS, null);
  return { screen: 'title' };
}
