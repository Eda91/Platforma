export function trackZkSearch(zk) {
  const raw = localStorage.getItem("zk_search_events");
  const events = raw ? JSON.parse(raw) : [];

  events.push({
    zk,
    t: Date.now(),
  });

  localStorage.setItem("zk_search_events", JSON.stringify(events));
    window.dispatchEvent(new Event("zkClicksUpdated"));
}