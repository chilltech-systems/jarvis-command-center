export function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(random: () => number, min: number, max: number) {
  return min + (max - min) * random();
}

export function weightedChoice<T>(random: () => number, choices: { value: T; weight: number }[]) {
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = random() * total;
  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) return choice.value;
  }
  return choices[choices.length - 1].value;
}
