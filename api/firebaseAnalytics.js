import { doc, runTransaction } from "firebase/firestore";
import { db } from "../src/firebase";

export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  const ref = doc(db, "clicks", zk);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);

    const current = snap.exists() ? snap.data().count || 0 : 0;

    transaction.set(
      ref,
      {
        count: current + 1,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  });
}