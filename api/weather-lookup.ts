import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors";

const WMO_CODES: Record<number, { en: string; zu: string }> = {
  0: { en: "Clear sky", zu: "Isibhakabhaka esihlanzekile" },
  1: { en: "Mainly clear", zu: "Kusobala kakhulu" },
  2: { en: "Partly cloudy", zu: "Kunamafu amancane" },
  3: { en: "Overcast", zu: "Kunamafu amaningi" },
  45: { en: "Foggy", zu: "Kunkungu" },
  51: { en: "Light drizzle", zu: "Imvula encane" },
  61: { en: "Slight rain", zu: "Imvula encane" },
  63: { en: "Moderate rain", zu: "Liyanetha" },
  65: { en: "Heavy rain", zu: "Liyathela imvula" },
  80: { en: "Slight showers", zu: "Imvula esheshayo" },
  95: { en: "Thunderstorm", zu: "Isiphepho sokuduma" },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { location } = req.body;
  if (!location || typeof location !== "string") return res.status(400).json({ error: "Please provide a location name." });

  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return res.status(404).json({ error: `Could not find location "${location}".` });

    const { latitude, longitude, name, country, admin1 } = geoData.results[0];
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&timezone=auto`);
    const weatherData = await weatherRes.json();
    if (!weatherData.current) return res.status(502).json({ error: "Weather data unavailable." });

    const cur = weatherData.current;
    const condition = WMO_CODES[cur.weather_code] || { en: "Unknown", zu: "Esingaziwa" };
    return res.json({
      location: { name, region: admin1 || "", country },
      temperature_c: cur.temperature_2m,
      feels_like_c: cur.apparent_temperature,
      humidity_percent: cur.relative_humidity_2m,
      wind_speed_kmh: cur.wind_speed_10m,
      uv_index: cur.uv_index,
      condition_en: condition.en,
      condition_zu: condition.zu,
      summary_en: `${name}${admin1 ? `, ${admin1}` : ""}, ${country}: ${cur.temperature_2m}°C (feels like ${cur.apparent_temperature}°C), ${condition.en}. Humidity ${cur.relative_humidity_2m}%, wind ${cur.wind_speed_10m} km/h.`,
      summary_zu: `${name}: Kushisa ngo-${cur.temperature_2m}°C (kuzwakala njengo-${cur.apparent_temperature}°C). ${condition.zu}.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Weather lookup failed" });
  }
}
