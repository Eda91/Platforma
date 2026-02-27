import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

/* ===================== STATUS CONFIG ===================== */
const statusConfig = {
  me_rf: { label: "✔ Përfunduar", color: "#1f7a3f", bg: "#e6f4ea" },
  pa_rf: { label: "✖ Pa përfunduar", color: "#b02a37", bg: "#fde2e4" },
  proces_rf: { label: "⏳ Në proces", color: "#e67700", bg: "#fff5e0" },
};

/* ===================== STYLES ===================== */
const containerStyle = {
  padding: "32px",
  background: "#f3f4f6",
  fontFamily: "system-ui, sans-serif",
  minHeight: "100vh",
};

const cardStyle = {
  background: "white",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  transition: "all 0.2s ease-in-out",
};

const badgeStyle = (type) => ({
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "600",
  background: statusConfig[type].bg,
  color: statusConfig[type].color,
  textAlign: "center",
  minWidth: "80px",
});

/* ===================== TABLE ===================== */
function DataTable({ data }) {
  if (!data.length) {
    return (
      <div
        style={{
          ...cardStyle,
          marginTop: 16,
          textAlign: "center",
          color: "#555",
        }}
      >
        Nuk ka të dhëna.
      </div>
    );
  }

  return (
    <div
      style={{
        ...cardStyle,
        marginTop: 0,
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: "70vh",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "separate" }}>
        <thead>
          <tr>
            {["Zona", "Emri", "Drejtoria", "Bashkia", "Qarku", "Statusi"].map(
              (title, i) => (
                <th
                  key={i}
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#ffffff",
                    zIndex: 10,
                    textAlign: "left",
                    padding: "18px 12px",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#222",
                    borderBottom: "2px solid #e5e7eb",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  }}
                >
                  {title}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: "1px solid #f1f3f5",
                transition: "background 0.2s",
              }}
            >
              <td style={{ padding: "12px" }}>{row["ZONA KADASTRALE"]}</td>
              <td style={{ padding: "12px" }}>
                {row["EMRI I ZONËS KADASTRALE"]}
              </td>
              <td style={{ padding: "12px" }}>
                {row["DREJTORIA VENDORE ASHK"]}
              </td>
              <td style={{ padding: "12px" }}>{row["BASHKIA"]}</td>
              <td style={{ padding: "12px" }}>{row["QARKU"]}</td>
              <td style={{ padding: "12px" }}>
                <span style={badgeStyle(row._type)}>
                  {statusConfig[row._type].label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== MAIN ===================== */
export default function ZonaDashboard() {
  const [datasets, setDatasets] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fileKeys = ["me_rf", "pa_rf", "proces_rf"];

  useEffect(() => {
    const loadData = async () => {
      try {
        const results = await Promise.all(
          fileKeys.map(async (key) => {
            const res = await fetch(
              `${import.meta.env.BASE_URL}json/${key}.json`,
            );
            if (!res.ok) throw new Error(`Error loading ${key}`);
            const data = await res.json();
            return data.map((row) => ({ ...row, _type: key }));
          }),
        );
        setDatasets(results.flat());
      } catch (err) {
        console.error("Gabim gjatë ngarkimit:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchInput.trim().toLowerCase()),
      180,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredData = useMemo(() => {
    let result = !debouncedSearch
      ? [...datasets]
      : datasets.filter((row) =>
          Object.values(row).join(" ").toLowerCase().includes(debouncedSearch),
        );
    return result.sort(
      (a, b) => Number(a["ZONA KADASTRALE"]) - Number(b["ZONA KADASTRALE"]),
    );
  }, [datasets, debouncedSearch]);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, color: "#111", fontSize: "20px" }}>
            Statusi i Regjistrimit Fillestar së Zonave Kadastrale
          </h2>
        
        </div>

    
        {/* SEARCH */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <input
            placeholder="Kërko zonë / bashki / qark..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #d0d5dd",
              outline: "none",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
          />
        </div>

        {/* LOADING */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#004aad",
              fontWeight: 500,
            }}
          >
            ⏳ Duke ngarkuar të dhënat...
          </div>
        )}

        {/* TABLE */}
        {!loading && <DataTable data={filteredData} />}

        {/* NO RESULTS */}
        {!loading && debouncedSearch && filteredData.length === 0 && (
          <p style={{ color: "red", marginTop: "10px", fontWeight: 500 }}>
            Nuk u gjet asnjë rezultat!
          </p>
        )}
      </div>
    </div>
  );
}
