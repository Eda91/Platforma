import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../src/firebase";

export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  const ref = doc(db, "clicks", zk);

  await updateDoc(ref, {
    count: increment(1),
    updatedAt: new Date().toISOString(),
  });
}