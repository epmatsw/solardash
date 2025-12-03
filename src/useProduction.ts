import { useEffect, useState } from "react";
import { isWeekend, isSameDay, getMonth } from "date-fns";
// @ts-expect-error
import holidays from "@date/holidays-us";

type RawProductionStat = {
  production: Array<WattHour | null>;
  start_time: number;
};

export type ProductionStat = {
  production: string;
  total: Dollar;
  productionData: Array<WattHour | null>;
  startTime: number;
  productionNum: WattHour;
  offUsage: WattHour;
  midUsage: WattHour;
  peakUsage: WattHour;
  offTotal: Dollar;
  midTotal: Dollar;
  peakTotal: Dollar;
  optimalTotal: Dollar;
};

export type Watt = number & {
  _watt: any;
};

export type WattHour = number & {
  _wattHour: any;
};

export type Kilowatt = number & {
  _kw: any;
};

export type KilowattHour = number & {
  _kwh: any;
};

type Cent = number & {
  _cent: any;
};

export type Dollar = number & {
  _dollar: any;
};

// Xcel Colorado moved to a 2-period TOU schedule effective Nov 1, 2025.
// Keep both sets of rates so historical data uses the old schedule and new data
// uses the current one.
const newTouEffectiveDate = new Date("2025-11-01T00:00:00-06:00");

// Old plan (pre–Nov 1, 2025) - cents/kWh
const offCostSummer = 8 as Cent;
const midCostSummer = 14 as Cent;
const peakCostSummer = 21 as Cent;
const offCostWinter = 8 as Cent;
const midCostWinter = 10 as Cent;
const peakCostWinter = 13 as Cent;

// New plan (effective Nov 1, 2025) - cents/kWh
const newOffCostSummer = 7.884 as Cent;
const newPeakCostSummer = 21.277 as Cent;
const newOffCostWinter = 6.792 as Cent;
const newPeakCostWinter = 18.331 as Cent;

const centsToDollars = (c: Cent): Dollar => (c / 100) as Dollar;
const wattHoursToKWh = (w: WattHour): KilowattHour =>
  (w / 1000) as KilowattHour;

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
  const month = getMonth(start_time * 1000);
  const isNewTou = start_time * 1000 >= newTouEffectiveDate.getTime();
  const isWinter = month >= 9 || month < 5;
  let off: Array<WattHour | null> = [],
    mid: Array<WattHour | null> = [],
    peak: Array<WattHour | null> = [];
  if (isWeekend(start_time * 1000)) {
    off.push(...productionData);
  } else if (holidayDays.some((day) => isSameDay(start_time * 1000, day))) {
    // https://my.xcelenergy.com/customersupport/s/article/What-are-the-six-observed-holidays-that-are-considered-off-peak
    off.push(...productionData);
  } else {
    const midStart = 52; // 1:00 PM
    const peakStart = 60; // 3:00 PM
    const peakEnd = 76; // 7:00 PM
    const morning = productionData.slice(0, midStart);
    const night = productionData.slice(peakEnd);

    // New plan removes the mid-peak block; those hours become off-peak.
    const midday = productionData.slice(midStart, peakStart);

    off.push(...morning);
    if (isNewTou) {
      off.push(...midday);
    } else {
      mid.push(...midday);
    }
    peak.push(...productionData.slice(peakStart, peakEnd));
    off.push(...night);
  }

  const offUsage = off.reduce<WattHour>(
    (total: WattHour, val) => (total + (val ?? (0 as WattHour))) as WattHour,
    0 as WattHour
  );
  const midUsage = mid.reduce<WattHour>(
    (total: WattHour, val) => (total + (val ?? (0 as WattHour))) as WattHour,
    0 as WattHour
  );
  const peakUsage = peak.reduce<WattHour>(
    (total: WattHour, val) => (total + (val ?? (0 as WattHour))) as WattHour,
    0 as WattHour
  );
  const totalUsage: WattHour = (offUsage + midUsage + peakUsage) as WattHour;

  const offCost = isNewTou
    ? isWinter
      ? newOffCostWinter
      : newOffCostSummer
    : isWinter
      ? offCostWinter
      : offCostSummer;
  const peakCost = isNewTou
    ? isWinter
      ? newPeakCostWinter
      : newPeakCostSummer
    : isWinter
      ? peakCostWinter
      : peakCostSummer;
  const midCost = isNewTou
    ? offCost // mid period removed; keep structure but zeroed usage
    : isWinter
      ? midCostWinter
      : midCostSummer;

  const offTotal = (centsToDollars(offCost) *
    wattHoursToKWh(offUsage)) as Dollar;
  const peakTotal = (centsToDollars(peakCost) *
    wattHoursToKWh(peakUsage)) as Dollar;
  const midTotal = (centsToDollars(midCost) *
    wattHoursToKWh(midUsage)) as Dollar;
  const total = (offTotal + peakTotal + midTotal) as Dollar;

  const optimalTotal = (wattHoursToKWh(totalUsage) * centsToDollars(peakCost)) as Dollar;

  return {
    productionData,
    startTime: start_time * 1000,
    production: `${(totalUsage / 1000).toFixed(1)}kW`,
    productionNum: totalUsage,
    total,
    offUsage,
    midUsage,
    peakUsage,
    offTotal,
    peakTotal,
    midTotal,
    optimalTotal
  };
};

const loadFromDate = async () => {
  const fetchResult = await fetch(
    "./data.json",
    {
      body: null,
      cache: "no-cache",
      method: "GET",
    }
  );
  const { stats }= await fetchResult.json();
  return (stats as any[]).map((s: RawProductionStat) => getValue(s));
};

export const useProduction = () => {
  const [production, setProduction] = useState<ProductionStat[]>();
  useEffect(() => {
    const update = async () => {
      const old = await loadFromDate();
      setProduction(old);
    };
    update();
    const handle = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(handle);
  }, []);

  return production;
};
