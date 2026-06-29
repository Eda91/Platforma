import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../src/firebase";

const LEGACY_DOC_ID = "3bFrd9Iw5HtgL6tMR6YO";

export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  const globalRef = doc(db, "clicks", "global");
  const zkRef = doc(db, "clicks_zk", String(zk));
  const legacyRef = doc(db, "clicks", LEGACY_DOC_ID);

  try {
    await runTransaction(db, async (tx) => {
      const globalSnap = await tx.get(globalRef);
      const zkSnap = await tx.get(zkRef);
      const legacySnap = await tx.get(legacyRef);

      const globalCount = globalSnap.exists() ? globalSnap.data().count || 0 : 0;
      const zkCount = zkSnap.exists() ? zkSnap.data().count || 0 : 0;

      const legacyData = legacySnap.exists() ? legacySnap.data() : {};
      const zkBreakdown = legacyData.clicks || {};

      tx.set(globalRef, {
        count: globalCount + 1,
        updatedAt: serverTimestamp(),
      });

      tx.set(zkRef, {
        count: zkCount + 1,
        updatedAt: serverTimestamp(),
      });

      // 🔥 breakdown by ZK inside legacy doc
      tx.set(
        legacyRef,
        {
          clicks: {
            ...zkBreakdown,
            [zk]: (zkBreakdown[zk] || 0) + 1,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    console.log("UPLOAD OK");
  } catch (err) {
    console.error("UPLOAD ERROR", err);
  }
}