import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "../src/firebase";

export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  const zkRef = doc(db, "clicks", String(zk));
  const globalRef = doc(db, "clicks", "global");
  const legacyRef = doc(db, "clicks", "3bFrd9Iw5HtgL6tMR6YO");

  try {
    await Promise.all([
      setDoc(
        zkRef,
        {
          clicks: increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ),

      setDoc(
        globalRef,
        {
          clicks: increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ),

      setDoc(
        legacyRef,
        {
          clicks: {
            [zk]: increment(1),
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ),
    ]);
  } catch (err) {
    console.error("uploadStats error:", err);
  }
}