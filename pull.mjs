import fs from "fs/promises";

const numToString = (n) => {
  if (n < 10) {
    return `0${n}`;
  } else {
    return n.toString();
  }
};

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const date = now.getDate();
console.log(`Updating at ${now}`);

console.info("Reading data");
let previousData;
try {
  previousData = JSON.parse(
    await fs.readFile("./public/data.json", { encoding: "utf8" })
  );
} catch (e) {
  console.error("Unable to read data");
  console.error(e);
  process.exit(5);
}
console.info("Read data", Date.now() - now.getTime());

const url = `https://enlighten.enphaseenergy.com/pv/public_systems/2875024/daily_energy?start_date=${year}-${numToString(
  month
)}-${numToString(date)}&end_date=${year}-${numToString(month)}-${numToString(
  date
)}`;

console.info("Downloading data");
let data;

now = Date.now();
try {
  data = await fetch(url);
} catch (e) {
  console.error("Unable to fetch data (no status)");
  console.error(e);
  process.exit(4);
}

if (!data.ok) {
  console.error(`Unable to fetch data (${data.status}) from ${url}`);
  console.error(await data.text());
  process.exit(1);
}
console.info("Downloaded data", Date.now() - now);

now = Date.now();
console.info("Parsing data");
let todaysData;
try {
  todaysData = await data.json();
} catch (e) {
  console.error("Unable to parse data");
  console.error(e);
  process.exit(3);
}
console.info("Parsed data", Date.now() - now);

now = Date.now();
const datesToReplace = new Map(todaysData.stats.map((s) => [s.start_time, s]));

const newData = {
  stats: previousData.stats
    .filter(({ production }) => production.some((p) => typeof p === "number"))
    .map((existingStat) => {
      if (datesToReplace.has(existingStat.start_time)) {
        const newStat = datesToReplace.get(existingStat.start_time);
        datesToReplace.delete(existingStat.start_time);
        return newStat;
      } else {
        return existingStat;
      }
    }),
};

newData.stats.push(...Array.from(datesToReplace.values()));

console.info("Generated data", Date.now() - now);

now = Date.now();
console.log("Writing file");

try {
  await fs.writeFile("./public/data.json", JSON.stringify(newData, null, 4), {
    encoding: "utf8",
  });
} catch (e) {
  console.error(e);
  process.exit(2);
}

console.log(`Finished update at ${now}`, Date.now() - now);
