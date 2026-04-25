import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun, CloudLightning, CloudFog, Loader2, MapPin } from "lucide-react";

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  code: number;
  locationName?: string;
}

const codeToIcon = (code: number) => {
  // WMO weather interpretation codes (Open-Meteo)
  if (code === 0) return { Icon: Sun, label: "Clear" };
  if (code === 1 || code === 2) return { Icon: CloudSun, label: "Partly cloudy" };
  if (code === 3) return { Icon: Cloud, label: "Cloudy" };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: "Fog" };
  if (code >= 51 && code <= 67) return { Icon: CloudRain, label: "Rain" };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: "Snow" };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, label: "Showers" };
  if (code >= 85 && code <= 86) return { Icon: CloudSnow, label: "Snow showers" };
  if (code >= 95) return { Icon: CloudLightning, label: "Thunderstorm" };
  return { Icon: Cloud, label: "—" };
};

const WeatherWidget = ({ compact = false }: { compact?: boolean }) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather fetch failed");
        const j = await res.json();
        if (cancelled) return;
        setData({
          temp: Math.round(j.current.temperature_2m),
          feelsLike: Math.round(j.current.apparent_temperature),
          humidity: Math.round(j.current.relative_humidity_2m),
          code: j.current.weather_code,
        });
        setLoading(false);

        // Reverse geocode (best effort)
        try {
          const gRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`
          );
          if (gRes.ok) {
            const gj = await gRes.json();
            const name = gj?.results?.[0]?.name;
            if (name && !cancelled) setData((d) => (d ? { ...d, locationName: name } : d));
          }
        } catch { /* ignore */ }
      } catch (e) {
        if (!cancelled) {
          setError("Unable to load weather");
          setLoading(false);
        }
      }
    };

    if (!navigator.geolocation) {
      setError("Geolocation unavailable");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        // Fallback: Bangkok
        fetchWeather(13.7563, 100.5018);
      },
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading weather…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        {error ?? "No weather"}
      </div>
    );
  }

  const { Icon, label } = codeToIcon(data.code);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card/40 px-2 py-1">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold tabular leading-none">{data.temp}°</span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular leading-none">{data.temp}°</span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <div className="text-xs text-muted-foreground tabular">
          Feels <span className="font-semibold text-foreground">{data.feelsLike}°</span>
        </div>
        <div className="text-xs text-muted-foreground tabular">
          Humidity <span className="font-semibold text-foreground">{data.humidity}%</span>
        </div>
        {data.locationName && (
          <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {data.locationName}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;
