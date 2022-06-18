import { useEffect, useMemo, useState } from "react";
import { Body, Equator, Observer } from "astronomy-engine";

export type Data = {
  watts: number;
  wattHours?: number;
  date: Date;
};

type Response = {
  result: {
    watt_hours: Record<string, number>;
    watt_hours_day: Record<string, number>;
    watts: Record<string, number>;
  };
};

const lat = 39.8;
const long = -105.08;
const observer = new Observer(lat, long, 0);
const equ_ofdate = Equator(Body.Sun, new Date(), observer, true, true);
const dec = equ_ofdate.dec.toFixed(2);

const apiKey =
  (new URLSearchParams(window.location.search).get("apiKey") ||
    localStorage.getItem("apiKey")) ??
  "fakekey";

const maxKwAC = 7.67;
const maxKwDC = 9.88;
const maxKw = maxKwAC;

const publicUrl = `https://api.forecast.solar/estimate/${lat}/${long}/${dec}/-15/${maxKw}`;
const privateUrl = apiKey
  ? `https://api.forecast.solar/${apiKey}/estimate/${lat}/${long}/${dec}/-15/${maxKw}`
  : undefined;

export const useForecast = () => {
  const [forecast, setForecast] = useState<Required<Data>[]>();
  const [days, setDays] = useState<{ date: Date; value: number }[]>();
  const [api, setApi] = useState<"Public" | "Personal" | "Cached">();

  useEffect(() => {
    (async function () {
      let fetchResult;
      if (privateUrl) {
        try {
          fetchResult = await fetch(privateUrl);
          setApi("Personal");
          if (apiKey !== "fakekey") {
            localStorage.setItem("apiKey", apiKey);
          }
        } catch {}
      }
      if (!fetchResult) {
        try {
          fetchResult = await fetch(publicUrl);
          setApi("Public");
        } catch {}
      }

      let result: Response["result"];
      if (fetchResult) {
        result = ((await fetchResult.json()) as Response).result;
        localStorage.setItem("forecast", JSON.stringify(result));
      } else {
        const cachedValue = localStorage.getItem("forecast");
        if (!cachedValue) throw new Error("Couldn't get data anywhere");
        setApi("Cached");
        result = JSON.parse(cachedValue);
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
        const dateString = key.replace(" ", "T");
        const date = new Date(dateString);
        days.push({
          date,
          value: result.watt_hours_day[key],
        });
      }

      setForecast(processed);
      setDays(days);
    })();
  }, []);

  const maxWatts = useMemo(() => {
    let max = -Infinity;
    if (!forecast) return 0;
    for (const item of forecast) {
      if (item.watts > max) max = item.watts;
    }
    return max * 1.5;
  }, [forecast]);

  const maxWattHours = useMemo(() => {
    let max = -Infinity;
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
