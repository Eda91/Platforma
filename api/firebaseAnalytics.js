import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "../src/firebase";

export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  await setDoc(
    doc(db, "clicks", "3bFrd9Iw5HtgL6tMR6YO"),
    {
      [zk]: increment(1),
      updatedAt: new Date()
    },
    { merge: true }
  );
}