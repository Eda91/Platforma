import React, { useEffect, useMemo, useState } from "react";

/* ===================== STYLES ===================== */

const containerStyle = {
  marginTop: "20px",
  padding: "20px",
  background: "#f7f7f7",
  minHeight: "100vh",
};

const tableContainerStyle = {
  background: "#fff",
  borderRadius: "10px",
  padding: "10px",
  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
  height: "70vh",
  overflowY: "auto",
};

const thStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
  background: "#fff",
  color: "#000",
  fontWeight: "bold",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tdStyle = {
  border: "1px solid #ddd",
  padding: "6px",
  color: "black",
};

/* ===================== MEMOIZED TABLE ===================== */

const DataTable = React.memo(function DataTable({ data }) {
  return (
    <div style={tableContainerStyle}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>ZK</th>
            <th style={thStyle}>Zona</th>
            <th style={thStyle}>Nr. Pasurie</th>
            <th style={thStyle}>Vol</th>
            <th style={thStyle}>Faqe</th>
            <th style={thStyle}>Pronarët</th>
            <th style={thStyle}>Kufizimet</th>
            <th style={thStyle}>Sipërfaqe</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => (
            <tr
              key={idx}
              style={{ background: idx % 2 ? "#fafafa" : "#fff" }}
            >
              <td style={tdStyle}>{r.Zk_Numer ?? "-"}</td>
              <td style={tdStyle}>{r.Zk_Emer ?? "-"}</td>
              <td style={tdStyle}>{r.Nr_Pas ?? "-"}</td>
              <td style={tdStyle}>{r.Vol ?? "-"}</td>
              <td style={tdStyle}>{r.Faqe ?? "-"}</td>
              <td style={tdStyle}>{r.Pronaret ?? "-"}</td>
              <td style={tdStyle}>{r.Kufizimet ?? "-"}</td>
              <td style={tdStyle}>{r.Siperfaqe ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* ===================== MAIN COMPONENT ===================== */

export default function Lista() {
  const [allData, setAllData] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);

  /* -------- Load GeoJSON -------- */
  useEffect(() => {
const files = [
  import.meta.env.BASE_URL + "geojson/loti5.geojson",
  import.meta.env.BASE_URL + "geojson/loti6.geojson",
];


    Promise.all(files.map((f) => fetch(f).then((r) => r.json())))
      .then((datasets) => {
        const features = datasets.flatMap((d) => d.features || []);

        const prepared = features.map((f) => {
          const p = f.properties || {};
          return {
            ...p,
            _searchText: `${p.Zk_Emer ?? ""} ${p.Pronaret ?? ""}`.toLowerCase(),
          };
        });

        setAllData(prepared);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* -------- Filter only on button click -------- */
  const filteredResults = useMemo(() => {
    if (!searchValue) return allData;
    return allData.filter((row) =>
      row._searchText.includes(searchValue)
    );
  }, [allData, searchValue]);

  const handleSearch = () => {
    setSearchValue(searchInput.trim().toLowerCase());
  };

  /* ===================== RENDER ===================== */

  return (
    <div style={containerStyle}>
      <h2 style={{ marginBottom: "15px", color: "black" }}>
        Kërko pasuri sipas listës
      </h2>

      {/* SEARCH BAR */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Kërko sipas Pronarit"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            background: "#fff",
            color: "#000",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />

        <button
          onClick={handleSearch}
          style={{
            padding: "10px 18px",
            backgroundColor: "#004aad",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Kërko
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: "center", padding: "30px", color: "#004aad" }}>
          <strong>⏳ Duke ngarkuar të dhënat...</strong>
        </div>
      )}

      {/* TABLE */}
      {!loading && <DataTable data={filteredResults} />}

      {/* NO RESULTS */}
      {!loading && searchValue && filteredResults.length === 0 && (
        <p style={{ color: "red", marginTop: "10px" }}>
          Nuk u gjet asnjë rezultat
        </p>
      )}
    </div>
  );
}
