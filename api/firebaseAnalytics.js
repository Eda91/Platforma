export async function uploadStats(zk) {
  if (!zk || zk === "-" || zk === "0") return;

  const ref = doc(db, "clicks", zk);

  await setDoc(
    ref,
    {
      clicks: increment(1),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}