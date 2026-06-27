const fs = require("fs");
const path = require("path");

const GEO_DIR = path.join(__dirname, "../public/geojson");
const OUT_DIR = path.join(__dirname, "../src/config");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const files = fs
  .readdirSync(GEO_DIR)
  .filter((file) => file.endsWith(".geojson"));

const zkList = [];
const zkMap = {};

/* =========================
   ZK EXTRACTOR (ROBUST)
========================= */
function extractZK(file, props) {
  // 1. nga properties
  let zk =
    props?.Zk_Numer ||
    props?.ZK ||
    props?.zk ||
    props?.Zk ||
    null;

  if (zk) return String(zk).trim();

  // 2. nga filename (kap 4 shifra)
  const matchFile = file.match(/\d{4}/);
  if (matchFile) return matchFile[0];

  // 3. fallback nga çdo tekst në properties
  const allValues = Object.values(props || {}).join(" ");
  const matchProps = allValues.match(/\d{4}/);
  if (matchProps) return matchProps[0];

  return null;
}

/* =========================
   LOOP FILES
========================= */
files.forEach((file) => {
  const filePath = path.join(GEO_DIR, file);

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(raw);

    const firstFeature = json.features?.[0];
    const props = firstFeature?.properties || {};

    const zk = extractZK(file, props);

    if (!zk) {
      console.log(`❌ Nuk u gjet ZK te file: ${file}`);
      return;
    }

    // shmang duplicate në list
    if (!zkList.find((x) => x.zk === zk)) {
      zkList.push({ zk, file });
    }

    const publishDate =
      props.publish_date ||
      props.data_publikimit ||
      props.created_at ||
      "2026-01-01";

    const zkName =
      props.Zk_Emer ||
      props.ZK_EMER ||
      props.ZONA_EMER ||
      props.EMRI_ZK ||
      file.replace(".geojson", "");

    const start = new Date(publishDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 45);

    // vetëm një herë për ZK
    if (!zkMap[zk]) {
      zkMap[zk] = {
        name: zkName,
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }

  } catch (err) {
    console.error(`⛔ Gabim te file ${file}:`, err.message);
  }
});

/* =========================
   SORT + EXPORT
========================= */
zkList.sort((a, b) => Number(a.zk) - Number(b.zk));

fs.writeFileSync(
  path.join(OUT_DIR, "zkList.json"),
  JSON.stringify(zkList, null, 2)
);

fs.writeFileSync(
  path.join(OUT_DIR, "afatetZK.json"),
  JSON.stringify(zkMap, null, 2)
);

console.log(`✅ U gjeneruan ${zkList.length} Zona Kadastrale`);