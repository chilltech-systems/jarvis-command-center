import { weather as mockWeather } from "@/lib/mock-data/ava";

const LOCATION = {
  name: process.env.AVA_WEATHER_LOCATION || "The Woodlands, TX",
  latitude: 30.1658,
  longitude: -95.4613,
};

const WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  80: "Rain showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorms",
  96: "Thunderstorms with hail",
  99: "Severe thunderstorms",
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    cloud_cover?: number;
    precipitation?: number;
    rain?: number;
    showers?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

function conditionFromCloudCover(cloudCover: number) {
  if (cloudCover >= 88) return "Cloudy";
  if (cloudCover >= 50) return "Mostly cloudy";
  if (cloudCover >= 25) return "Partly cloudy";
  return "Mostly clear";
}

function displayCondition({
  code,
  cloudCover,
  precipitation,
  rainChance,
}: {
  code: number;
  cloudCover: number;
  precipitation: number;
  rainChance: number;
}) {
  const rawCondition = WEATHER_CODES[code] || "Current conditions available";
  const stormCode = code >= 95;

  if (stormCode && precipitation <= 0 && rainChance < 20) {
    return conditionFromCloudCover(cloudCover);
  }

  return rawCondition;
}

function recommendation({ rainChance, high, condition, precipitation }: { rainChance: number; high: number; condition: string; precipitation: number }) {
  if ((/thunder/i.test(condition) && precipitation > 0) || rainChance >= 55) return "I would keep errands earlier and leave extra travel buffer for storms.";
  if (high >= 95) return "I would keep outdoor work early and water nearby.";
  if (rainChance >= 30) return "I would keep an umbrella close and avoid tight outdoor plans.";
  return "I do not see a major weather adjustment needed.";
}

export async function getAvaWeather() {
  const params = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    current: "temperature_2m,cloud_cover,precipitation,rain,showers,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "America/Chicago",
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    let response: Response;
    try {
      response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
    const data = await response.json() as OpenMeteoResponse;
    const code = data.current?.weather_code ?? 0;
    const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? mockWeather.high);
    const low = Math.round(data.daily?.temperature_2m_min?.[0] ?? mockWeather.low);
    const rainChance = Math.round(data.daily?.precipitation_probability_max?.[0] ?? mockWeather.rainChance);
    const precipitation = data.current?.precipitation ?? 0;
    const condition = displayCondition({
      code,
      cloudCover: data.current?.cloud_cover ?? 0,
      precipitation,
      rainChance,
    });
    return {
      source: "open-meteo",
      location: LOCATION.name,
      temperature: Math.round(data.current?.temperature_2m ?? mockWeather.temperature),
      condition,
      high,
      low,
      rainChance,
      windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
      precipitation,
      recommendation: recommendation({ rainChance, high, condition, precipitation }),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...mockWeather,
      source: "mock",
      error: error instanceof Error && error.name === "AbortError" ? "Weather fetch timed out" : error instanceof Error ? error.message : "Weather fetch failed",
      updatedAt: new Date().toISOString(),
    };
  }
}
