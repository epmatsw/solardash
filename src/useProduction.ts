import { useEffect, useState } from "react";
import { isWeekend, isSameDay } from "date-fns";
// @ts-expect-error
import holidays from "@date/holidays-us";

type RawProductionStat = {
  production: Array<Watt | null>;
  start_time: number;
};

type ProductionStat = {
  production: string;
  total: Dollar;
  productionData: Array<Watt | null>;
  startTime: number;
  productionNum: Watt;
  offUsage: Watt;
  midUsage: Watt;
  peakUsage: Watt;
};

export type Watt = number & {
  _watt: any;
};

export type Kilowatt = number & {
  _kw: any;
};

type Cent = number & {
  _cent: any;
};

export type Dollar = number & {
  _dollar: any;
};

const offCost = 9 as Cent;
const midCost = 18 as Cent;
const peakCost = 26 as Cent;

const centsToDollars = (c: Cent): Dollar => (c / 100) as Dollar;
const wattsToKW = (w: Watt): Kilowatt => (w / 1000) as Kilowatt;

const thisYear = new Date().getFullYear();
const newYearsDay = holidays.newYearsDay(thisYear);
const memorialDay = holidays.memorialDay(thisYear);
const independenceDay = holidays.independenceDay(thisYear);
const laborDay = holidays.laborDay(thisYear);
const thanksgiving = holidays.thanksgiving(thisYear);
const christmas = holidays.christmas(thisYear);

const holidayDays = [
  newYearsDay,
  memorialDay,
  independenceDay,
  laborDay,
  thanksgiving,
  christmas,
];

const getValue = ({
  production: productionData,
  start_time,
}: RawProductionStat): ProductionStat => {
  let off: Array<Watt | null> = [],
    mid: Array<Watt | null> = [],
    peak: Array<Watt | null> = [];
  if (isWeekend(start_time * 1000)) {
    off.push(...productionData);
  } else if (holidayDays.some((day) => isSameDay(start_time * 1000, day))) {
    // https://my.xcelenergy.com/customersupport/s/article/What-are-the-six-observed-holidays-that-are-considered-off-peak
    off.push(...productionData);
  } else {
    const morning = productionData.slice(0, 52);
    const night = productionData.slice(76);
    off.push(...morning, ...night);
    mid.push(...productionData.slice(52, 60));
    peak.push(...productionData.slice(60, 76));
  }

  const offUsage = off.reduce<Watt>(
    (total: Watt, val) => (total + (val ?? (0 as Watt))) as Watt,
    0 as Watt
  );
  const midUsage = mid.reduce<Watt>(
    (total: Watt, val) => (total + (val ?? (0 as Watt))) as Watt,
    0 as Watt
  );
  const peakUsage = peak.reduce<Watt>(
    (total: Watt, val) => (total + (val ?? (0 as Watt))) as Watt,
    0 as Watt
  );
  const totalUsage: Watt = (offUsage + midUsage + peakUsage) as Watt;

  const offTotal = (centsToDollars(offCost) * wattsToKW(offUsage)) as Dollar;
  const peakTotal = (centsToDollars(peakCost) * wattsToKW(peakUsage)) as Dollar;
  const midTotal = (centsToDollars(midCost) * wattsToKW(midUsage)) as Dollar;
  const total = (offTotal + peakTotal + midTotal) as Dollar;

  return {
    productionData,
    startTime: start_time * 1000,
    production: `${(totalUsage / 1000).toFixed(1)}kW`,
    productionNum: totalUsage,
    total,
    offUsage,
    midUsage,
    peakUsage,
  };
};

export const useProduction = () => {
  const [production, setProduction] = useState<ProductionStat[]>();
  useEffect(() => {
    (async function () {
      try {
        const fetchResult = await fetch(
          "https://api.allorigins.win/get?url=" +
            encodeURIComponent(
              "https://enlighten.enphaseenergy.com/pv/public_systems/2875024/daily_energy?start_date=2022-06-01"
            ),
          {
            body: null,
            method: "GET",
          }
        );
        const proxyResponse = await fetchResult.json();
        const { stats } = JSON.parse(proxyResponse.contents);
        setProduction(stats.map((s: RawProductionStat) => getValue(s)));
      } catch {}
    })();
  }, []);

  return production;
};
