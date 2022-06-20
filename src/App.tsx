import React, { useDeferredValue, useEffect, useRef, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { useForecast } from "./useForecast";
import { Dollar, useProduction, Watt } from "./useProduction";
import { isToday } from "date-fns";

const formatter = new Intl.DateTimeFormat("en-US", {
  weekday: "narrow",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});
const hourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
});

const getLast5 = <T,>(a: T[]): T[] => {
  const len = a.length;
  if (len < 5) {
    return a.slice();
  } else {
    return a.slice(len - 5);
  }
};

const formatKw = (value: Watt) => `${(value / 1000).toFixed(1)}kW`;
const formatKwVague = (value: Watt) => `${Math.round(value / 1000)}kW`;
const formatKwPrecise = (value: Watt) => `${(value / 1000).toFixed(2)}kW`;
const formatCurrency: (d: Dollar) => string = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format;

const getChartHeight = () => window.innerHeight / 3 - 20;

const getChartWidth = () => window.innerWidth / 2 - 20;

function App() {
  const { forecast, days, api, maxWatts, maxWattHours } = useForecast();
  const production = useProduction();

  const [_chartHeight, setChartHeight] = useState(getChartHeight());
  const [_chartWidth, setChartWidth] = useState(getChartWidth());

  const chartHeight = useDeferredValue(_chartHeight);
  const chartWidth = useDeferredValue(_chartWidth);

  const outerRef = useRef();

  useEffect(() => {
    const listener = new ResizeObserver((entries) => {
      for (const entry of entries) {
      const borderBoxSize = Array.isArray(entry.borderBoxSize) ? (entry.borderBoxSize[0]  as ResizeObserverSize) : (entry.borderBoxSize as any as ResizeObserverSize);
      setChartHeight(borderBoxSize.blockSize / 3 - 20);
      setChartWidth(borderBoxSize.inlineSize / 3 - 20);
      }
    })
    if (outerRef.current) {
      listener.observe(outerRef.current);
      return () => {
        listener.disconnect();
      }
    }
  }, []);

  if (!forecast && !days && !production) return <div>Loading...</div>;

  const totalValue =
    production?.reduce<Dollar>(
      (sum: Dollar, p) => (sum + p.total ?? 0) as Dollar,
      0 as Dollar
    ) ?? (0 as Dollar);
  const daysForValue =
    production?.reduce((s: number, p) => (p.total > 0 ? s + 1 : s), 0) ?? 0;
  const perDay =
    daysForValue > 0 ? ((totalValue / daysForValue) as Dollar) : (0 as Dollar);

  let productionDays = 0;
  const totalProductionNumber =
    production?.reduce<Watt>((sum: Watt, p) => {
      if (typeof p.productionNum === "number") {
        productionDays++;
      }
      return (sum + p.productionNum ?? 0) as Watt;
    }, 0 as Watt) ?? (0 as Watt);
  const totalProduction = formatKw(totalProductionNumber);

  const productionWithTimes:
    | Array<{ watts: Watt | undefined; date: Date }>
    | undefined = production?.flatMap((p) => {
    return p.productionData.map((d, i) => {
      return {
        watts: d == null ? undefined : ((d * 4) as Watt),
        date: new Date(p.startTime + i * 15 * 60 * 1000),
      };
    });
  });

  const comboData = forecast?.map((f) => {
    const production = productionWithTimes?.find(
      (p) => p.date.getTime() === f.date.getTime()
    );
    return {
      ...f,
      production: production?.watts,
    };
  });

  const todayProduction = production?.find((p) => isToday(p.startTime));

  const todayData = comboData?.filter((d) => isToday(d.date));

  return (
    <div
      // @ts-expect-error
      ref={outerRef}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
        blockSize: "100svh",
        padding: "5px",
        gap: "20px"
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          blockSize: "100%",
          justifyContent: "space-evenly",
        }}
      >
        {!!todayData && (
          <LineChart width={chartWidth} height={chartHeight} data={todayData}>
            <Line dataKey={"watts"} dot={false} strokeDasharray="2 2"></Line>
            <Line dataKey={"production"} dot={false} strokeWidth={2}></Line>
            <XAxis dataKey={"date"} tickFormatter={hourFormatter.format} />
            <YAxis max={maxWatts} tickFormatter={formatKwVague} />
          </LineChart>
        )}
        {!!comboData && (
          <LineChart width={chartWidth} height={chartHeight} data={comboData}>
            <Line dataKey={"watts"} dot={false} strokeDasharray="2 2"></Line>
            <Line dataKey={"production"} dot={false} strokeWidth={2}></Line>
            <XAxis dataKey={"date"} tickFormatter={formatter.format} />
            <YAxis max={maxWatts} tickFormatter={formatKwVague} />
          </LineChart>
        )}
        {!!days && (
          <LineChart width={chartWidth} height={chartHeight} data={days}>
            <Line dataKey={"value"} dot={false}></Line>
            <XAxis dataKey={"date"} tickFormatter={dayFormatter.format} />
            <YAxis max={maxWattHours} tickFormatter={formatKwVague} />
          </LineChart>
        )}
      </span>
      <span>
        {!!todayProduction && (
          <>
            <div>
              Today:
              <br />
              Value: {formatCurrency(todayProduction.total)}
              <br />
              Production: {formatKwPrecise(todayProduction.productionNum)}
              <br />
              Off Peak: {formatKwPrecise(todayProduction.offUsage)}
              <br />
              Mid Peak: {formatKwPrecise(todayProduction.midUsage)}
              <br />
              On Peak: {formatKwPrecise(todayProduction.peakUsage)}
            </div>
            <br />
          </>
        )}
        {!!production && (
          <>
            Last {productionDays} Days:
            <br />
            Value: {formatCurrency(totalValue)} ({formatCurrency(perDay)}
            /day)
            <br />
            Production: {totalProduction} (
            {formatKw((totalProductionNumber / (productionDays || 1)) as Watt)}
            /day)
            <br />
            {getLast5(production).map((a) => (
              <React.Fragment key={a.startTime}>
                <span>
                  {dayFormatter.format(a.startTime)} {formatKw(a.productionNum)}
                </span>
                <br />
              </React.Fragment>
            ))}
            <br />
          </>
        )}
        <div>
          {days?.map(({ value, date }) => {
            const startOfDay = new Date(date);
            startOfDay.setHours(0);
            startOfDay.setMinutes(0);
            const productionData = production?.find(
              (p) => p.startTime === startOfDay.getTime()
            );
            const sum = (
              (productionData?.productionData.reduce(
                (r: number, v) => r + (v ?? 0),
                0
              ) ?? 0) / 1000
            ).toFixed(1);
            const money = formatCurrency(
              productionData?.total ?? (0 as Dollar)
            );
            return (
              <div key={date.getTime()}>
                {dayFormatter.format(date)}: {formatKw(value)}
                {!!production && (
                  <>
                    {" "}
                    (Actual: {sum}kW, {money})
                  </>
                )}
              </div>
            );
          })}
          <br />
          {!!api && <div>Using {api} API</div>}
        </div>
      </span>
    </div>
  );
}
export default App;
