import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Event = {
  date: string;
  time: string;
  place: string;
  status: string;
};

type Shipment = {
  trackingId: string;
  currentStatus: string;
  expected: string;
  events: Event[];
  sourceUrl: string;
  checkedAt: string;
};

const DEFAULT_ID = "FMPP4257349570";
const POLL_MS = 5 * 60 * 1000;

function eventKey(e: Event) {
  return `${e.date}|${e.time}|${e.place}|${e.status}`;
}

function App() {
  const [trackingId, setTrackingId] = useState(
    localStorage.getItem("ekart_tracking_id") || DEFAULT_ID
  );
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(
    localStorage.getItem("ekart_auto_refresh") !== "false"
  );
  const [notifications, setNotifications] = useState(false);
  const previousRef = useRef<Shipment | null>(null);
  const firstLoadRef = useRef(true);

  const notify = useCallback(async (title: string, body: string) => {
    if (!notifications || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/favicon.svg" });
  }, [notifications]);

  const track = useCallback(async (silent = false) => {
    const id = trackingId.trim().toUpperCase();
    if (!id) return;

    if (!silent) setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/track/${encodeURIComponent(id)}`, {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Tracking failed");

      const next = data as Shipment;
      const previous = previousRef.current;

      if (previous && previous.trackingId === next.trackingId) {
        const oldKeys = new Set(previous.events.map(eventKey));
        const newEvents = next.events.filter(e => !oldKeys.has(eventKey(e)));

        if (
          newEvents.length ||
          previous.currentStatus !== next.currentStatus ||
          previous.expected !== next.expected
        ) {
          const latest = newEvents.at(-1) || next.events.at(-1);
          await notify(
            `Ekart update — ${next.trackingId}`,
            latest
              ? `${latest.status} • ${latest.place}`
              : next.currentStatus
          );
        }
      }

      previousRef.current = next;
      setShipment(next);
      localStorage.setItem("ekart_tracking_id", id);

      if (firstLoadRef.current) firstLoadRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to fetch tracking data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [trackingId, notify]);

  useEffect(() => {
    track();
  }, [trackingId, track]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => track(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, track]);

  useEffect(() => {
    localStorage.setItem("ekart_auto_refresh", String(autoRefresh));
  }, [autoRefresh]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setError("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotifications(true);
      new Notification("Ekart Tracker enabled", {
        body: "You will be notified when the tracking data changes."
      });
    } else {
      setError("Notification permission was not granted.");
    }
  }

  const latest = shipment?.events.at(-1);
  const route = useMemo(() => {
    if (!shipment) return [];
    return shipment.events
      .map(e => e.place)
      .filter((v, i, a) => i === 0 || v !== a[i - 1]);
  }, [shipment]);

  return (
    <div className="app">
      <header className="nav">
        <div className="brand"><span className="logo">E</span><span>Ekart Tracker</span></div>
        <div className="nav-actions">
          <span className="live"><i /> Live polling</span>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <p className="kicker">SHIPMENT MONITOR</p>
          <h1>Know the moment<br /><span>your parcel moves.</span></h1>
          <p className="sub">Enter an Ekart tracking ID. The app checks the public Ekart tracking page every 5 minutes and highlights new scans.</p>
        </section>

        <section className="search">
          <label>Ekart tracking ID</label>
          <div className="search-row">
            <input
              value={trackingId}
              onChange={e => setTrackingId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && track()}
              placeholder="FMPP4257349570"
              spellCheck={false}
            />
            <button onClick={() => track()} disabled={loading}>
              {loading ? "Checking…" : "Track package"}
            </button>
          </div>
          <div className="controls">
            <label className="check"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto-refresh every 5 minutes</label>
            <button className="notify" onClick={enableNotifications}>🔔 Enable notifications</button>
          </div>
        </section>

        {error && <div className="error">⚠ {error}</div>}

        {shipment && (
          <>
            <section className="cards">
              <div className="card status-card">
                <span>Current status</span>
                <strong>{shipment.currentStatus || latest?.status || "Unknown"}</strong>
                <small>Checked {new Date(shipment.checkedAt).toLocaleString()}</small>
              </div>
              <div className="card">
                <span>Latest scan</span>
                <strong>{latest?.place || "—"}</strong>
                <small>{latest ? `${latest.date} · ${latest.time}` : "—"}</small>
              </div>
              <div className="card">
                <span>Expected</span>
                <strong>{shipment.expected || "Not available"}</strong>
                <small>{shipment.events.length} tracking events</small>
              </div>
            </section>

            <section className="route card">
              <div className="section-head">
                <div><span className="eyebrow">ROUTE</span><h2>Shipment journey</h2></div>
                <a href={shipment.sourceUrl} target="_blank" rel="noreferrer">Open Ekart ↗</a>
              </div>
              <div className="route-line">
                {route.map((place, i) => (
                  <div className="route-stop" key={`${place}-${i}`}>
                    <div className={`route-dot ${i === route.length - 1 ? "active" : ""}`} />
                    <span>{place}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="timeline card">
              <div className="section-head">
                <div><span className="eyebrow">TRACKING DETAILS</span><h2>Timeline</h2></div>
                <span className="id">{shipment.trackingId}</span>
              </div>
              <div className="events">
                {[...shipment.events].reverse().map((event, i) => (
                  <div className="event" key={`${eventKey(event)}-${i}`}>
                    <div className={`event-dot ${i === 0 ? "active" : ""}`} />
                    <div className="event-content">
                      <div className="event-title">{event.status}</div>
                      <div className="event-meta"><b>{event.place}</b><span>{event.date} · {event.time}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer>Uses Ekart's public tracking webpage. This app does not use private APIs or bypass authentication/CAPTCHA.</footer>
      </main>
    </div>
  );
}

export default App;