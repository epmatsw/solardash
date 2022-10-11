import { useEffect, useMemo, useState } from "react";
import { Watt, WattHour } from "./useProduction";

export type Data = {
  watts: Watt;
  wattHours?: WattHour;
  date: Date;
};

type Response = {
  result: {
    watt_hours: Record<string, WattHour>;
    watt_hours_day: Record<string, WattHour>;
    watts: Record<string, Watt>;
  };
};

const lat = 39.8;
const long = -105.08;
const dec = 15;

const apiKey =
  (new URLSearchParams(window.location.search).get("apiKey") ||
    localStorage.getItem("apiKey") ||
    process.env.REACT_APP_API_KEY) ??
  "fakekey";

const maxKwAC = 7.67;
const maxKwDC = 9.88;
const maxKw = maxKwAC;

const publicUrl = `https://api.forecast.solar/estimate/${lat}/${long}/${dec}/-15/${maxKw}`;
const privateUrl = apiKey
  ? `https://api.forecast.solar/${apiKey}/estimate/${lat}/${long}/${dec}/-15/${maxKw}`
  : undefined;

export const forecastDataCacheKey = "forecast";

export const useForecast = (fetchCount: number) => {
  const [forecast, setForecast] = useState<Required<Data>[]>();
  const [days, setDays] = useState<{ date: Date; value: WattHour }[]>();
  const [api, setApi] = useState<"Public" | "Personal" | "Cached">();

  useEffect(() => {
    (async function () {
      let result: Response["result"] | undefined = undefined;

      if (process.env.NODE_ENV === "development") {
        const cachedValue = localStorage.getItem(forecastDataCacheKey);
        if (cachedValue) {
          setApi("Cached");
          result = JSON.parse(cachedValue);
        }
      }

      if (process.env.NODE_ENV !== "development" || !result) {
        if (privateUrl) {
          try {
            const fetchResult = await fetch(privateUrl);
            if (fetchResult.status !== 200) {
              throw new Error();
            }
            result = ((await fetchResult.json()) as Response).result;
            setApi("Personal");
            localStorage.setItem(forecastDataCacheKey, JSON.stringify(result));
            if (apiKey !== "fakekey") {
              localStorage.setItem("apiKey", apiKey);
            }
          } catch {}
        }
        if (!result) {
          try {
            const fetchResult = await fetch(publicUrl);
            if (fetchResult.status !== 200) {
              throw new Error();
            }
            result = ((await fetchResult.json()) as Response).result;
            localStorage.setItem(forecastDataCacheKey, JSON.stringify(result));
            setApi("Public");
          } catch {}
        }
        if (!result) {
          const cachedValue = localStorage.getItem("forecast");
          if (!cachedValue) throw new Error("Couldn't get data anywhere");
          setApi("Cached");
          result = JSON.parse(cachedValue);
        }
      }

      if (!result) {
        if (!result) throw new Error("Couldn't get data anywhere");
      }

      const processed: Required<Data>[] = [];
      for (const key in result.watts) {
        if (!result.watts.hasOwnProperty(key)) continue;
        if (!result.watt_hours.hasOwnProperty(key)) continue;
        const dateString = key.replace(" ", "T");
        const date = new Date(dateString);
        processed.push({
          date,
          wattHours: result.watt_hours[key],
          watts: result.watts[key],
        });
      }

      const days = [];
      for (const key in result.watt_hours_day) {
        if (!result.watt_hours_day.hasOwnProperty(key)) continue;
        const dateString = `${key}T00:00:00`;
        const date = new Date(dateString);
        console.log(date, dateString);
        days.push({
          date,
          value: result.watt_hours_day[key],
        });
      }

      setForecast(processed);
      setDays(days);
    })();
  }, [fetchCount]);

  const maxWatts = useMemo(() => {
    let max = -1;
    if (!forecast) return 0;
    for (const item of forecast) {
      if (item.watts > max) max = item.watts;
    }
    return max * 1.5;
  }, [forecast]);

  const maxWattHours = useMemo(() => {
    let max = -1;
    if (!forecast) return 0;
    for (const item of forecast) {
      if (item.wattHours > max) max = item.wattHours;
    }
    return max * 1.5;
  }, [forecast]);

  return {
    forecast,
    days,
    api,
    maxWatts,
    maxWattHours,
  };
};
