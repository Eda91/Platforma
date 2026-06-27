import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

import { buildZkDataset } from "../api/getzkstats";
import zkListRaw from "../src/config/zkList.json";
import afatetZK from "../src/config/afatetZK.json";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../src/firebase";
import "../src/statistics.css";

export default function Statistics() {
  const [clickMap, setClickMap] = useState({});

 const navigate = useNavigate();

  /* ================= LOAD CLICK DATA ================= */
useEffect(() => {
  const load = async () => {
    try {
      const snap = await getDoc(
        doc(db, "clicks", "3bFrd9Iw5HtgL6tMR6YO")
      );

      const data = snap.exists() ? snap.data().clicks : {};

      setClickMap(data || {});
    } catch (err) {
      console.error(err);
      setClickMap({});
    }
  };

  load();
}, []);



  const logout = () => {
  localStorage.removeItem("isLoggedIn");
  navigate("/login");
};

  /* ================= DATA ================= */
  const rows = useMemo(() => buildZkDataset(clickMap), [clickMap]);

  /* ================= TOP ZONES ================= */
  const topData = useMemo(() => {
    return [...rows]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
  }, [rows]);

  /* ================= METRICS ================= */
  const totalClicks = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0),
    [rows]
  );

  const activeZones = useMemo(
    () => rows.filter((r) => r.isActive).length,
    [rows]
  );

  const inactiveZones = rows.length - activeZones;

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

const safeRows = (rows || [])
  .sort((a, b) => b.clicks - a.clicks)

  const latestZones = Object.entries(afatetZK)
  .map(([zk, value]) => ({
    zk,
    name: value.name,
    start: value.start,
    end: value.end
  }))
  .sort((a, b) => new Date(b.start) - new Date(a.start))
  .slice(0, 10);
const logoutBtnStyle = {
  position: "absolute",
  top: "12px",
  right: "12px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(37,99,235,0.35)",
};

  /* ================= UI ================= */
  return (
    <div style={styles.page}>
      <h2 style={{ marginBottom: 20 }}>📊 Paneli i Statistikave ZK</h2>
   <button
  onClick={logout}
  style={logoutBtnStyle}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = "0 10px 25px rgba(37,99,235,0.5)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 18px rgba(37,99,235,0.35)";
  }}
>
  Logout
</button>

      {/* ================= CARDS ================= */}
      <div style={styles.cards}>
          <div style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20
        }}>
  
<div
  style={{
    ...cardStyle,
    background: "#c9dffc", // Blue
    border: "2px solid #3B82F6",
  }}
>
    <div style={titleStyle}>🌍 Zona Totale</div>
    <div style={valueStyle}>{rows.length}</div>
  </div>

  <div
  style={{
    ...cardStyle,
    background: "#fff8ad", // Yellow
    border: "2px solid #EAB308",
  }}
>
    <div style={titleStyle}>👁 Klikime Totale</div>
    <div style={valueStyle}>{totalClicks}</div>
  </div>

 <div
  style={{
    ...cardStyle,
    background: "#acf0c0", // Green
    border: "2px solid #22C55E",
  }}
>
  <div style={titleStyle}>🟢 Aktive</div>
  <div style={{ ...valueStyle, color: "#15803D" }}>
    {activeZones}
  </div>
</div>

 <div
  style={{
    ...cardStyle,
    background: "#fcb7b7", // Red
    border: "2px solid #EF4444",
  }}
>
  <div style={titleStyle}>🔴 Jo Aktive</div>
  <div style={{ ...valueStyle, color: "#B91C1C" }}>
    {inactiveZones}
  </div>
</div>

</div>
          <div style={card}>
            🆕 Zonat e Fundit

            {latestZones.map((z, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                borderBottom: "1px solid #111111",
                background:" #f8f8f8",
              }}>
                <div>
                  <b>{z.name}</b>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    ZK: {z.zk}
                  </div>
                </div>

                <div style={{ fontSize: 12 }}>
                 Data e Publikimit: {z.start}
                </div>
              </div>
            ))}
          </div>
      </div>

      {/* ================= MAIN ================= */}
      <div style={styles.grid}>
        
        {/* ================= CHART ================= */}
<div style={panel}>
  <h3>📊 Shpërndarja e Klikimeve për të gjitha Zonat</h3>

<div style={{
  width: "100%",
  height: 520,
  overflowX: "auto",
  overflowY: "hidden",
  border: "2px solid #94a3b8",
  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  background:"#d4ddeb",
 
}}>
  <div style={{ minWidth: 2700 }}>
<ResponsiveContainer width="100%" height={500}>
  <BarChart data={safeRows}>
    <CartesianGrid strokeDasharray="3 3" />
    
    <XAxis
      dataKey="zk"
      interval={0}
      angle={-25}
      textAnchor="end"
    />

    <YAxis />

    <Tooltip />

    <Bar dataKey="clicks" fill="#4f46e5" />
  </BarChart>
</ResponsiveContainer>
        </div>
        </div>
        </div>
        

        {/* ================= TABLE ================= */}
        <div style={panel}>
          <h3>📋 Statusi i Zonave</h3>

          <div style={{ maxHeight: 523, overflowY: "auto",  border: "2px solid #94a3b8",
  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",}}>

            {/* HEADER */}
            <div style={styles.header}>
              <div>ZK</div>
              <div>Klikime</div>
              <div>Status</div>
              <div>Fillon</div>
              <div>Mbaron</div>
            </div>

            {/* ROWS */}
            {rows.map((r) => (
              <div key={r.zk} style={styles.row}>
                <div style={{ fontWeight: 600 }}>{r.zk}</div>
                <div>{r.clicks}</div>

                {/* STATUS DOT */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: r.isActive ? "#10B981" : "#EF4444",
                    }}
                  />
                  {r.isActive ? "AKTIVE" : "JO AKTIVE"}
                </div>

                <div>{r.start || "-"}</div>
                <div>{r.end || "-"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  page: {
    padding: 20,
    background: "#f8fafc",
    minHeight: "100vh",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 15,
    marginBottom: 20,
  },
  grid: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "80px 80px 120px 1fr 1fr",
    padding: "10px",
    fontWeight: 700,
    background: "#f1f5f9",
    position: "sticky",
    top: 0,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "80px 80px 120px 1fr 1fr",
    padding: "10px",
    borderBottom: "1px solid #eee",
    fontSize: 14,
  },
};

const card = {
  background: "#ffffff",
  padding: 12,
   border: "2px solid #bfbff8",
  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
 fontSize: 14,
};

const panel = {
  flex: 1,
  minWidth: 420,
  background: "#fff",
  padding: 15,
  borderRadius: 12,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: 10,
  padding: "8px 12px",
  border: "2px solid #94a3b8",
  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 170,
  transition: "0.2s ease"
};

const titleStyle = {
  fontSize: 18,
  color: "#000000",
  fontWeight: 500
};

const valueStyle = {
  fontSize: 28,
  fontWeight: 700,
  color: "#0f172a"
};