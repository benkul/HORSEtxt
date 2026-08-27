// Weather. GRAMMAR.md §6.4.
//
// v0.1 returned an independent fresh value per axis, which was a placeholder wearing
// the right shape. This is the behaviour the section always described:
//
//   - correlated, in the documented directions
//   - autocorrelated, because weather changes slowly
//   - `cold` conditioned by the individual, against its lower critical temperature
//
// Read, never generated. A horse does not roll for weather; it reads a condition it
// can neither control nor predict, and so does everyone else standing outside.

// Weather is exogenous and shared: two animals awake at the same moment are in the
// same weather. So it is derived from the clock rather than from a private roll,
// which also gives autocorrelation for free — read it twice in a minute and it has
// barely moved, because a minute is nothing to a weather front.
const FRONT_MS = 6 * 3600 * 1000;   // a front takes about six hours to pass
const SEASON_MS = 365.25 * 24 * 3600 * 1000;

// Deterministic value noise. Keyframes at every period boundary, smoothly
// interpolated, so the signal is continuous in time and stable across readers.
function keyframe(n, salt) {
  let h = (n | 0) ^ (salt * 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = h ^ (h >>> 15);
  return (h >>> 0) / 4294967296;
}

function smooth(t, period, salt) {
  const x = t / period;
  const i = Math.floor(x);
  const f = x - i;
  const ease = f * f * (3 - 2 * f); // smoothstep: no corners at the keyframes
  return keyframe(i, salt) * (1 - ease) + keyframe(i + 1, salt) * ease;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The year. 0 at midwinter, 1 at midsummer, anchored so the northern seasons land
// where a northern reader expects them.
const MIDWINTER = Date.UTC(1970, 0, 4);
function season(now) {
  const turns = ((now - MIDWINTER) % SEASON_MS) / SEASON_MS;
  return 0.5 - 0.5 * Math.cos(turns * 2 * Math.PI);
}

// Three drivers, not five axes. The five conditions are read off these, which is
// where the correlations come from: they share causes, as real weather does.
function drivers(now) {
  return {
    // A weather front: brings both water and wind, which is why they co-occur.
    front: smooth(now, FRONT_MS, 1),
    // Air temperature: the year, plus weather on top of it. The year is a real
    // cycle rather than noise — averaging two noise signals narrows the
    // distribution toward its middle, which left the air sitting near freezing all
    // year and every warm-weather reading downstream of it stuck at zero.
    warmth: clamp01(
      0.72 * season(now) +
      0.28 * smooth(now, FRONT_MS * 4, 2),
    ),
    // Cloud cover, partly driven by the same front.
    cloud: smooth(now, FRONT_MS * 1.5, 4),
  };
}

// The lower critical temperature: the point below which an animal must burn energy
// to stay warm. It is not a constant — +5°C for a horse in a mild climate against
// −15°C for one adapted to cold, with acclimatization taking about three weeks, and
// coat and age moving it further.
//
// With no declared individual there is no body to be cold, so `cold` reads the
// unconditioned air and nothing else.
function lowerCritical(individual) {
  if (!individual) return null;

  let lct = -5; // an ordinary unclipped horse
  for (const t of individual.traits || []) {
    if (t.kind === "age" && typeof t.value === "number") {
      // The very young and the old hold heat less well, so they start feeling it
      // sooner: their critical temperature is higher.
      if (t.value < 3) lct += 4;
      else if (t.value > 18) lct += 3;
    }
    if (t.kind === "tag" && /clip/.test(t.value)) lct += 10; // a clipped coat is no coat
    if (t.kind === "tag" && /northern|hardy|acclimat/.test(t.value)) lct -= 10;
  }
  return lct;
}

// Air temperature in °C from the warmth driver, over a plausible year.
const AIR_MIN = -20;
const AIR_MAX = 30;

export class Weather {
  constructor(host = {}) {
    this.host = host;
    this.individual = null;
  }

  now() {
    return typeof this.host.now === "function" ? this.host.now() : Date.now();
  }

  read(condition) {
    const d = drivers(this.now());
    const air = AIR_MIN + d.warmth * (AIR_MAX - AIR_MIN);

    // Water falls out of a front, and only when there is cloud to fall from.
    const wet = clamp01(d.front * 1.3 - 0.25) * clamp01(d.cloud * 1.4);
    // Wind rides the same front, so wind and wet arrive together. No floor: still
    // days have to be genuinely still, or nothing downstream of stillness can ever
    // reach a high value.
    const wind = clamp01(d.front * 1.25 - 0.18);
    // Sun is what the cloud is not.
    const sun = clamp01((1 - d.cloud) * (0.4 + 0.6 * d.warmth));

    switch (condition) {
      case "wet":
        return wet;
      case "wind":
        return wind;
      case "sun":
        return sun;

      // Distance below the lower critical temperature, not a temperature — and the
      // compounding is the documented part: a wet coat loses up to 90% of its
      // insulation and wind strips the warm layer off the skin, so cold rain with
      // wind is more demanding than low temperature alone. Mejdell's horses asked
      // for a blanket at a mild +5 to +10°C when it came with rain or strong wind.
      case "cold": {
        const lct = lowerCritical(this.individual);
        if (lct === null) {
          // No body to be cold. The air, and nothing else.
          return clamp01((AIR_MAX - air) / (AIR_MAX - AIR_MIN));
        }
        const insulation = 1 - 0.9 * wet;            // a wet coat is barely a coat
        const stripped = 1 - 0.5 * wind * (1 - wet); // wind takes the warm layer
        const effective = air - (1 - insulation * stripped) * 12;
        const below = lct - effective;
        return clamp01(below / 20);
      }

      // Insects are the largest behavioural driver of the five, and they run against
      // the others: wet and windy weather significantly reduces harassment, while
      // flies are active in sun and avoid shade. The conditions that make an animal
      // cold are the conditions that relieve it of flies.
      case "flies": {
        const warm = clamp01((air - 10) / 15);
        // Suppression, not exclusion: rain and wind reduce harassment sharply but
        // do not multiply it away. Stacking four sub-unit factors made this axis
        // unreachable — it never passed 0.07 across a whole year, which is not what
        // "the largest behavioural driver of the five" looks like.
        const suppressed = (1 - 0.8 * wet) * (1 - 0.7 * wind);
        return clamp01(warm * suppressed * (0.45 + 0.55 * sun));
      }

      default:
        throw new TypeError(`${condition} is not a weather condition`);
    }
  }
}
