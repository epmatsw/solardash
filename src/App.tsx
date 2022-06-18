import { Body, Equator, Observer } from "astronomy-engine";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

type Data = {
  watts: number;
  wattHours: number;
  date: Date;
};

type Response = {
  result: {
    watt_hours: Record<string, number>;
    watt_hours_day: Record<string, number>;
    watts: Record<string, number>;
  };
};

const formatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const lat = 39.8;
const long = -105.08;
const observer = new Observer(lat, long, 0);
const equ_ofdate = Equator(Body.Sun, new Date(), observer, true, true);
const dec = equ_ofdate.dec.toFixed(2);

const apiKey = new URLSearchParams(window.location.search).get("apiKey");

const maxKwAC = 7.67;
const maxKwDC = 9.88;
const maxKw = maxKwAC;

const publicUrl = `https://api.forecast.solar/estimate/${lat}/${long}/${dec}/-15/${maxKw}`;
const privateUrl = apiKey
  ? `https://api.forecast.solar/${apiKey}/estimate/${lat}/${long}/${dec}/-15/${maxKw}`
  : undefined;

const formatKw = (value: number) => `${Math.round(value / 1000)}kW`;

function App() {
  const [data, setData] = useState<Data[]>();
  const [days, setDays] = useState<{ date: Date; value: number }[]>();
  const [api, setApi] = useState<"Public" | "Personal">();

  useEffect(() => {
    (async function () {
      let fetchResult;
      if (privateUrl) {
        try {
          fetchResult = await fetch(privateUrl);
          setApi("Personal");
        } catch {}
      }
      if (!fetchResult) {
        fetchResult = await fetch(publicUrl);
        setApi("Public");
      }
      const { result } = (await fetchResult.json()) as Response;

      const processed: Data[] = [];
      for (const key in result.watts) {
        if (!result.watts.hasOwnProperty(key)) continue;
        if (!result.watt_hours.hasOwnProperty(key)) continue;
        const date = new Date(key);
        processed.push({
          date,
          wattHours: result.watt_hours[key],
          watts: result.watts[key],
        });
      }

      const days = [];
      for (const key in result.watt_hours_day) {
        if (!result.watt_hours_day.hasOwnProperty(key)) continue;
        const date = new Date(key);
        days.push({
          date,
          value: result.watt_hours_day[key],
        });
      }

      setData(processed);
      setDays(days);
    })();
  }, []);

  const maxWatts = useMemo(() => {
    let max = -Infinity;
    if (!data) return 0;
    for (const item of data) {
      if (item.watts > max) max = item.watts;
    }
    return max * 1.5;
  }, [data]);

  const maxWattHours = useMemo(() => {
    let max = -Infinity;
    if (!data) return 0;
    for (const item of data) {
      if (item.wattHours > max) max = item.wattHours;
    }
    return max * 1.5;
  }, [data]);

  if (!data || !days) return <div>Loading...</div>;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
      }}
    >
      <span>
        <LineChart width={600} height={300} data={data}>
          <Line dataKey={"watts"} dot={false}></Line>
          <XAxis dataKey={"date"} tickFormatter={formatter.format} />
          <YAxis max={maxWatts} tickFormatter={formatKw} />
        </LineChart>
        <LineChart width={600} height={300} data={data}>
          <Line dataKey={"wattHours"} dot={false}></Line>
          <XAxis dataKey={"date"} tickFormatter={formatter.format} />
          <YAxis max={maxWattHours} tickFormatter={formatKw} />
        </LineChart>
        <div style={{ textAlign: "center" }}>{api} API</div>
      </span>
      <span>
        <div>
          {days.map(({ value, date }) => (
            <div>
              {dayFormatter.format(date)}: {formatKw(value)}
            </div>
          ))}
        </div>
      </span>
    </div>
  );
}
export default App;
