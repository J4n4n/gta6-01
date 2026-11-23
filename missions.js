// The story: Jax, a driver for hire in Solmar, owes $5,000 to Sal. The fixer
// Mara lines up three jobs to clear it. Each mission is a chain of steps:
// go somewhere, pick something up, deliver it, steal a marked car, lose the
// cops. The runner checks each step every tick and pays out on completion.
import { PLACES, MISSION_REWARDS } from './config.js';

export const STORY_INTRO =
  'Solmar. Jax owes Sal $5,000 and the clock is ticking. Mara, the fixer, has three jobs that pay it off. Drive, deliver, and stay out of the cells.';

export function createMissions() {
  return [
    {
      id: 'meet-mara',
      title: 'Job 0 — Meet Mara',
      brief: 'Mara is waiting at her garage in the south-west. Get there on foot or grab a car (E to enter). She has work for you.',
      reward: MISSION_REWARDS[0],
      steps: [
        { kind: 'goto', text: 'Go to Mara\'s Garage', target: PLACES.garage, radius: 90 },
      ],
    },
    {
      id: 'the-pickup',
      title: 'Job 1 — The Pickup',
      brief: 'A package is waiting at the Solmar Docks, east side. Pick it up and bring it back to Mara\'s Garage. A car helps — steal one if you have to.',
      reward: MISSION_REWARDS[1],
      steps: [
        { kind: 'goto', text: 'Pick up the package at the Docks', target: PLACES.docks, radius: 90 },
        { kind: 'goto', text: 'Deliver the package to Mara\'s Garage', target: PLACES.garage, radius: 90 },
      ],
    },
    {
      id: 'hot-wheels',
      title: 'Job 2 — Hot Wheels',
      brief: 'A buyer wants the yellow coupe parked in the North Lot. Steal it — the cops will notice — then lose them before you bring it to the garage.',
      reward: MISSION_REWARDS[2],
      steps: [
        { kind: 'steal', text: 'Steal the yellow coupe in the North Lot', target: PLACES.northLot, radius: 110, model: 'Coupe', color: '#e8c33d' },
        { kind: 'loseCops', text: 'Lose the cops, then deliver the coupe', target: PLACES.garage, radius: 110 },
      ],
    },
    {
      id: 'the-payoff',
      title: 'Job 3 — The Payoff',
      brief: 'Last one. Grab the cash bag downtown — Sal\'s men will call the cops the moment you touch it. Get the bag to Sal\'s Drop in the south-east and the debt is gone.',
      reward: MISSION_REWARDS[3],
      steps: [
        { kind: 'pickup', text: 'Grab the cash bag downtown', target: PLACES.downtown, radius: 90, setWanted: 3 },
        { kind: 'goto', text: 'Deliver the bag to Sal\'s Drop', target: PLACES.salDrop, radius: 100 },
      ],
    },
  ];
}

export function createMissionRunner(missions) {
  let index = 0;
  let stepIndex = 0;
  let active = false;
  let done = false;
  let toast = '';
  let toastTimer = 0;

  function current() {
    return missions[index] || null;
  }
  function currentStep() {
    const mission = current();
    return mission ? mission.steps[stepIndex] : null;
  }
  function start() {
    active = true;
    stepIndex = 0;
    done = false;
  }
  // Jump to a mission (used by the screenshot scenes, never by normal play).
  function jumpTo(i) {
    index = Math.max(0, Math.min(missions.length - 1, i));
    stepIndex = 0;
    active = false;
    done = false;
  }
  function objectiveText() {
    if (!active) return 'Talk to Mara to start work';
    if (done) return 'Debt paid. Solmar is yours — free roam.';
    const step = currentStep();
    const mission = current();
    return mission ? `${mission.title}: ${step.text}` : '';
  }
  function marker() {
    if (!active || done) return null;
    const step = currentStep();
    return step ? step.target : null;
  }
  function isDone() {
    return done;
  }
  function isActive() {
    return active;
  }
  function missionIndex() {
    return index;
  }
  function showToast(text, seconds) {
    toast = text;
    toastTimer = seconds;
  }
  function tickToast(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast = '';
    }
  }
  function getToast() {
    return toast;
  }

  // Advance the mission. `game` carries the player, the wanted level and the
  // car the player drives. Returns 'completed' | 'finished' | null.
  function update(dt, game) {
    tickToast(dt);
    if (!active || done) return null;
    const mission = current();
    const step = currentStep();
    if (!mission || !step) return null;
    const player = game.player;
    const px = player.onFoot ? player.x : player.car.x;
    const py = player.onFoot ? player.y : player.car.y;
    const dist = Math.hypot(px - step.target.x, py - step.target.y);
    let advance = false;
    if (step.kind === 'goto' || step.kind === 'pickup') {
      advance = dist < step.radius;
      if (advance && step.kind === 'pickup' && step.setWanted) {
        game.setWanted(step.setWanted);
        showToast('The cops are coming! Lose them and deliver the bag.', 3.5);
      }
    } else if (step.kind === 'steal') {
      // The step is done the moment the player is driving the marked coupe.
      const inMarkedCar = !player.onFoot && player.car
        && player.car.model === step.model && player.car.color === step.color;
      advance = inMarkedCar;
    } else if (step.kind === 'loseCops') {
      advance = game.wanted === 0 && dist < step.radius;
    }
    if (!advance) return null;
    if (step.kind === 'steal') game.setWanted(Math.max(game.wanted, 2));
    stepIndex += 1;
    if (stepIndex >= mission.steps.length) {
      const reward = mission.reward;
      game.player.money += reward;
      if (index === missions.length - 1) {
        done = true;
        showToast('DEBT PAID. Solmar is yours.', 6);
        return 'finished';
      }
      index += 1;
      stepIndex = 0;
      active = false;
      showToast(`Job done! +$${reward}. Talk to Mara for the next one.`, 4);
      return 'completed';
    }
    return null;
  }

  function fail() {
    active = false;
    stepIndex = 0;
  }

  return {
    current, currentStep, start, jumpTo, objectiveText, marker, isDone, isActive,
    missionIndex, update, fail, showToast, getToast,
  };
}
