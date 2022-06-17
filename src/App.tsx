import React, { useEffect, useMemo, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

type Data = {
  watts: number;
  wattHours: number;
  date: Date;
  formattedDate: string;
};

type Response = {
  result: {
    watt_hours: Record<string, number>;
    watts: Record<string, number>;
  };
};

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
});

const publicUrl =
  "https://api.forecast.solar/estimate/39.80/-105.08/23.39/-15/10";
const privateUrl =
  "https://api.forecast.solar/995108ca75752736/estimate/39.80/-105.08/23.39/-15/10";

function App() {
  const [data, setData] = useState<Data[]>();

  useEffect(() => {
    (async function () {
      const fetchResult = await fetch(privateUrl);
      const { result } = (await fetchResult.json()) as Response;

      const processed: Data[] = [];
      for (const key in result.watts) {
        if (!result.watts.hasOwnProperty(key)) continue;
        if (!result.watt_hours.hasOwnProperty(key)) continue;
        const date = new Date(key);
        processed.push({
          date,
          wattHours: Math.round(result.watt_hours[key] / 1000),
          watts: Math.round(result.watts[key] / 1000),
          formattedDate: formatter.format(date),
        });
      }

      setData(processed);
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

  if (!data) return <div>Loading...</div>;

  return (
    <>
      <LineChart width={600} height={300} data={data}>
        <Line dataKey={"watts"}></Line>
        <XAxis dataKey={"formattedDate"} />
        <YAxis max={maxWatts} />
      </LineChart>
      <LineChart width={600} height={300} data={data}>
        <Line dataKey={"wattHours"}></Line>
        <XAxis dataKey={"formattedDate"} />
        <YAxis max={maxWattHours} />
      </LineChart>
    </>
  );
}
export default App;
