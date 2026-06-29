import { doc, setDoc } from "firebase/firestore";
import { db } from "../src/firebase";

export async function uploadStats(stats) {
  try {
    await setDoc(
      doc(db, "clicks", "3bFrd9Iw5HtgL6tMR6YO"),
      {
        clicks: stats,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
  alert(
    err.code +
    "\n\n" +
    err.message
  );
  console.error(err);
}
}