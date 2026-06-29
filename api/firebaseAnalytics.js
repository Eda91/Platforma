import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "../src/firebase";

export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  const ref = doc(db, "clicks", "global");

  await setDoc(
    ref,
    {
      [zk]: increment(1),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}