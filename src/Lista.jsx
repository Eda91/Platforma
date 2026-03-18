import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

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
  textAlign: "center",
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
   textAlign: "center",
};
const afatetZK = {
  1349: { start: "2026-01-19", end: "2026-03-06" },
  3085: { start: "2026-01-19", end: "2026-03-06" },
  2950: { start: "2026-01-05", end: "2026-02-20" },
  3911: { start: "2026-01-05", end: "2026-02-20" },
  2983: { start: "2026-01-05", end: "2026-02-20" },
  2910: { start: "2026-01-19", end: "2026-03-06" },
  2674: { start: "2026-01-19", end: "2026-03-06" },
  2463: { start: "2026-01-05", end: "2026-02-20" },
  1278: { start: "2026-01-05", end: "2026-02-20" },
  2290: { start: "2026-01-19", end: "2026-03-06" },
  3080: { start: "2026-01-15", end: "2026-02-28" },
  2774: { start: "2026-01-15", end: "2026-02-28" },
  1973: { start: "2026-01-15", end: "2026-02-28" },
  1889: { start: "2026-01-15", end: "2026-02-28" },
  1662: { start: "2026-01-15", end: "2026-02-28" },
  1111: { start: "2026-01-15", end: "2026-02-28" },
  4002: { start: "2026-01-09", end: "2026-02-22" },
  2501: { start: "2026-01-09", end: "2026-02-22" },
  1743: { start: "2026-01-09", end: "2026-02-22" },
  2706: { start: "2026-01-15", end: "2026-03-01" },
  3366: { start: "2026-01-23", end: "2026-03-09" },
  3311: { start: "2026-01-23", end: "2026-03-09" },
  1968: { start: "2026-01-19", end: "2026-03-05" },
  1338: { start: "2026-02-20", end: "2026-04-06" },
  1350: { start: "2026-02-20", end: "2026-04-06" },
  2731: { start: "2026-02-20", end: "2026-04-06" },
  1599: { start: "2026-02-17", end: "2026-04-03" },
  3634: { start: "2026-02-17", end: "2026-04-03" },
  3012: { start: "2026-02-17", end: "2026-04-03" },
  3406: { start: "2026-02-17", end: "2026-04-03" },
  1011: { start: "2026-02-17", end: "2026-04-03" },
  1448: { start: "2026-02-26", end: "2026-04-12" },
  2564: { start: "2026-02-26", end: "2026-04-12" },
  2904: { start: "2026-02-26", end: "2026-04-12" },
  3873: { start: "2026-01-01", end: "2026-12-31" },
  2431: { start: "2026-01-01", end: "2026-12-31" },
  2152: { start: "2026-01-01", end: "2026-12-31" },
};

function isWithinDateRange(zkNumer) {
  const rule = afatetZK[zkNumer];
  if (!rule) return false;

  const today = new Date();
  const start = new Date(rule.start);
  const end = new Date(rule.end);

  return today >= start && today <= end;
}
/* ===================== FLEXIBLE FIELD MAP ===================== */
const fieldMap = {
  Zk_Numer: ["Zk_Numer", "ZK_NUMER", "zk_numer", "ZK", "Nr_Zk", "Nr_ZK"],
  Zk_Emer: ["Zk_Emer", "ZK_EMER", "zk_emer", "ZONA_EMER", "Emri_ZK"],
  Nr_Pas: ["Nr_Pas", "NR_PAS", "NR_PASURIE", "NrPas", "nr_pas", "Numri_i_Pa"],
  Vol: ["Vol", "VOL", "vol"],
  Faqe: ["Faqe", "FAQE", "faqe"],
  Pronaret: ["Pronaret", "PRONARET", "pronaret", "EMER_PRONA", "Emri_i_Pro"],
  Kufizimet: [
    "Kufizimet",
    "KUFIZIMET",
    "kufizimet",
    "KUFIZIM_E",
    "KUFIZIM_D",
    "TR_PERSH1",
  ],
  Siperfaqe: ["Siperfaqe", "SIPERFAQE", "siperfaqe", "AREA"],
};

function getFieldValue(props, keys) {
  for (const k of keys) {
    if (props[k] != null && props[k] !== "") return props[k];
  }
  for (const key in props) {
    for (const k of keys) {
      if (key.toLowerCase().includes(k.toLowerCase()) && props[key])
        return props[key];
    }
  }
  return "-";
}

/* ===================== MEMOIZED TABLE ===================== */
const DataTable = React.memo(function DataTable({ data }) {
  return (
    <div style={tableContainerStyle}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}
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
            <tr key={idx} style={{ background: idx % 2 ? "#fafafa" : "#fff" }}>
              <td style={tdStyle}>{r.Zk_Numer}</td>
              <td style={tdStyle}>{r.Zk_Emer}</td>
              <td style={tdStyle}>{r.Nr_Pas}</td>
              <td style={tdStyle}>{r.Vol}</td>
              <td style={tdStyle}>{r.Faqe}</td>
              <td style={tdStyle}>{r.Pronaret}</td>
              <td style={tdStyle}>{r.Kufizimet}</td>
              <td style={tdStyle}>{r.Siperfaqe}</td>
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
  const [debouncedInput, setDebouncedInput] = useState("");

  useEffect(() => {
    const files = [
      {
        url: import.meta.env.BASE_URL + "geojson/loti5.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/loti6.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/PARCELA_MLIZ_.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/NDERTESA_MLIZ_.geojson",
        type: "building",
      },

      {
        url: import.meta.env.BASE_URL + "geojson/SHAHINAJ_PARCELA.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SHETEL_PARCELA.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/HOTOVE_PARCELA.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/parcela1.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/parcela2.geojson",
        type: "parcel",
      },

        {
        url: import.meta.env.BASE_URL + "geojson/SH1448DA_P_ALL.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SH1448DA_N.geojson",
        type: "building",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SH2564MA_P_ALL.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SH2564MA_N.geojson",
        type: "building",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SH2904PE_P_ALL.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SH2904PE_N.geojson",
        type: "building",
      },

      {
        url: import.meta.env.BASE_URL + "geojson/parcela_dorezuar.geojson",
        type: "parcel",
      },

    ];

    Promise.all(
      files.map((f) =>
        fetch(f.url)
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to fetch ${f.url}`);
            return r.json();
          })
          .then((data) => ({ ...f, data })),
      ),
    )
      .then((layers) => {
        const prepared = layers.flatMap(({ data }) =>
          (data.features || []).map((f) => {
            const p = f.properties || {};
            const rawZkEmer = getFieldValue(p, fieldMap.Zk_Emer);
            const zkEmer = rawZkEmer && rawZkEmer !== "-" ? rawZkEmer : "MLIZ";
            const pronaret = getFieldValue(p, fieldMap.Pronaret);
            const kufizimetCombined = [
              getFieldValue(p, ["KUFIZIM_E"]),
              getFieldValue(p, ["KUFIZIM_D"]),
              getFieldValue(p, fieldMap.Kufizimet),
            ]
              .filter((v) => v && v !== "-")
              .join(" | ");
            return {
              Zk_Numer: getFieldValue(p, fieldMap.Zk_Numer),
              Zk_Emer: zkEmer,
              Nr_Pas: getFieldValue(p, fieldMap.Nr_Pas),
              Vol: getFieldValue(p, fieldMap.Vol),
              Faqe: getFieldValue(p, fieldMap.Faqe),
              Pronaret: pronaret,
              Kufizimet: kufizimetCombined,
              Siperfaqe: getFieldValue(p, fieldMap.Siperfaqe),
              _searchText:
                `${zkEmer} ${pronaret} ${kufizimetCombined}`.toLowerCase(),
            };
          }),
        );

        setAllData(prepared);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedInput(searchInput);
    }, 180); // ✅ small delay prevents freeze
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredResults = useMemo(() => {
    return allData.filter((row) => {
      // 1️⃣ kontrollo afatin
      const allowedByDate = isWithinDateRange(row.Zk_Numer);

      if (!allowedByDate) return false;
       const query = searchValue || debouncedInput.trim().toLowerCase();
      if (!query) return true;

      return row._searchText.includes(query);
    });
  }, [allData, searchValue,debouncedInput]);

  const handleSearch = () => {
    setSearchValue(searchInput.trim().toLowerCase());
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ marginBottom: "15px", color: "black" }}>
          Kërko pasuri sipas listës
        </h2>

        <button
          onClick={() => (window.location.hash = "#/")}
          className="back-button"
        >
          <ArrowLeft size={18} />
          <span className="btn-text">Kthehu</span>
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Kërko sipas Pronarit :"
          value={searchInput}
          onChange={(e) => {
            const val = e.target.value;
            setSearchInput(val);

            if (val.trim() === "") {
              setSearchValue("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
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

      {loading && (
        <div style={{ textAlign: "center", padding: "30px", color: "#004aad" }}>
          <strong>⏳ Duke ngarkuar të dhënat...</strong>
        </div>
      )}

      {!loading && <DataTable data={filteredResults} />}

      {!loading && searchValue && filteredResults.length === 0 && (
        <p style={{ color: "red", marginTop: "10px" }}>
          Nuk u gjet asnjë rezultat ose afati i afishimit ka përfunduar!
        </p>
      )}
    </div>
  );
}
