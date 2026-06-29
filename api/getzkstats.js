import zkListRaw from "../src/config/zkList.json";
import afatetZK from "../src/config/afatetZK.json";

const zkList = Array.isArray(zkListRaw)
  ? zkListRaw
  : Object.keys(zkListRaw).map((key) => ({
      zk: key,
      file: zkListRaw[key].file || "",
    }));

export function buildZkDataset(clickMap = {}) {
  const now = Date.now();

  return zkList.map((z) => {
    const afat = afatetZK?.[z.zk];

    const start = afat?.start ?? "-";
    const end = afat?.end ?? "-";

    const isActive =
      afat &&
      Date.parse(afat.start) <= now &&
      now <= Date.parse(afat.end);

    return {
      zk: z.zk,
      file: z.file,
      clicks: Number(clickMap[String(z.zk).trim()] ?? 0),
      start,
      end,
      status: isActive ? "ACTIVE" : "INACTIVE",
      isActive,
    };
  });
}