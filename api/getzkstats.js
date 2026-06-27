import zkListRaw from "../src/config/zkList.json";
import afatetZK from "../src/config/afatetZK.json";

const zkList = Array.isArray(zkListRaw)
  ? zkListRaw
  : Object.keys(zkListRaw).map((key) => ({
      zk: key,
      file: zkListRaw[key].file || "",
    }));

export function buildZkDataset(clickMap = {}) {
  const now = new Date();

  if (!Array.isArray(zkList)) {
    console.warn("zkList not array, fallback applied");
  }

  return zkList.map((z) => {
    const afat = afatetZK?.[z.zk] || null;

    const start = afat?.start ?? "-";
    const end = afat?.end ?? "-";

    const isActive =
      afat &&
      new Date(afat.start) <= now &&
      now <= new Date(afat.end);

    return {
      zk: z.zk,
      file: z.file,
      clicks: Number(clickMap[String(z.zk).trim()] || 0),
      start,
      end,
      status: isActive ? "ACTIVE" : "INACTIVE",
      isActive,
    };
  });
}