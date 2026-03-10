/**
 * Weather Lookup Edge Function
 *
 * Uses Open-Meteo (free, no API key needed) to get current weather.
 * Supports geocoding by city name, returns conditions in both
 * English and isiZulu.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// WMO weather codes → descriptions
const WMO_CODES: Record<number, { en: string; zu: string }> = {
  0: { en: "Clear sky", zu: "Isibhakabhaka esihlanzekile" },
  1: { en: "Mainly clear", zu: "Kusobala kakhulu" },
  2: { en: "Partly cloudy", zu: "Kunamafu amancane" },
  3: { en: "Overcast", zu: "Kunamafu amaningi" },
  45: { en: "Foggy", zu: "Kunkungu" },
  48: { en: "Depositing rime fog", zu: "Inkungu eqandayo" },
  51: { en: "Light drizzle", zu: "Imvula encane" },
  53: { en: "Moderate drizzle", zu: "Imvula ephakathi" },
  55: { en: "Dense drizzle", zu: "Imvula enkulu" },
  61: { en: "Slight rain", zu: "Imvula encane" },
  63: { en: "Moderate rain", zu: "Liyanetha" },
  65: { en: "Heavy rain", zu: "Liyathela imvula" },
  71: { en: "Slight snow", zu: "Iqhwa elincane" },
  73: { en: "Moderate snow", zu: "Iqhwa" },
  75: { en: "Heavy snow", zu: "Iqhwa elikhulu" },
  80: { en: "Slight rain showers", zu: "Imvula esheshayo" },
  81: { en: "Moderate rain showers", zu: "Izihlambi zemvula" },
  82: { en: "Violent rain showers", zu: "Isiphepho semvula" },
  95: { en: "Thunderstorm", zu: "Isiphepho sokuduma" },
  96: { en: "Thunderstorm with slight hail", zu: "Ukuduma nesichotho" },
  99: { en: "Thunderstorm with heavy hail", zu: "Ukuduma nesichotho esikhulu" },
};

function getWeatherDescription(code: number): { en: string; zu: string } {
  return WMO_CODES[code] || { en: "Unknown conditions", zu: "Isimo esingaziwa" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location } = await req.json();

    if (!location || typeof location !== "string") {
      return new Response(
        JSON.stringify({ error: "Please provide a location name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Geocode the location
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return new Response(
        JSON.stringify({ error: `Could not find location "${location}". Try a city name like "Durban" or "La Lucia".` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const place = geoData.results[0];
    const { latitude, longitude, name, country, admin1 } = place;

    // Step 2: Get current weather
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&timezone=auto`
    );
    const weatherData = await weatherRes.json();

    if (!weatherData.current) {
      return new Response(
        JSON.stringify({ error: "Weather data unavailable." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const current = weatherData.current;
    const condition = getWeatherDescription(current.weather_code);

    const result = {
      location: {
        name,
        region: admin1 || "",
        country,
        lat: latitude,
        lon: longitude,
      },
      temperature_c: current.temperature_2m,
      feels_like_c: current.apparent_temperature,
      humidity_percent: current.relative_humidity_2m,
      wind_speed_kmh: current.wind_speed_10m,
      uv_index: current.uv_index,
      condition_en: condition.en,
      condition_zu: condition.zu,
      weather_code: current.weather_code,
      // Pre-formatted responses
      summary_en: `${name}${admin1 ? `, ${admin1}` : ""}, ${country}: ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C), ${condition.en}. Humidity ${current.relative_humidity_2m}%, wind ${current.wind_speed_10m} km/h, UV index ${current.uv_index}.`,
      summary_zu: `${name}: Kushisa ngo-${current.temperature_2m}°C (kuzwakala njengo-${current.apparent_temperature}°C). ${condition.zu}. Umswakama ${current.relative_humidity_2m}%, umoya ${current.wind_speed_10m} km/h.`,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weather lookup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Weather lookup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
