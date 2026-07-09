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

/* ===================== AFATET ===================== */
const afatetZK = {
  3131: { start: "2026-04-27", end: "2026-06-11" },
  2239: { start: "2026-04-27", end: "2026-06-11" },
  1088: { start: "2026-04-27", end: "2026-06-11" },
  2806: { start: "2026-04-30", end: "2026-06-13" },
  2955: { start: "2026-05-18", end: "2026-07-02" },
  3067: { start: "2026-05-18", end: "2026-07-02" },
  2350: { start: "2026-05-20", end: "2026-07-03" },
  3376: { start: "2026-06-10", end: "2026-07-25" },
  1361: { start: "2026-06-11", end: "2026-07-25" },
  1084: { start: "2026-06-15", end: "2026-07-29" },
  2238: { start: "2026-06-17", end: "2026-07-31" },
  1885: { start: "2026-06-17", end: "2026-07-31" },
  2261: { start: "2026-06-18", end: "2026-08-01" },
  8573: { start: "2026-07-09", end: "2026-08-22" }
};

function isWithinDateRange(zkNumer) {
  const rule = afatetZK[zkNumer];
  if (!rule) return false;
  const today = new Date();
  return today >= new Date(rule.start) && today <= new Date(rule.end);
}

/* ===================== FLEXIBLE FIELD MAP ===================== */
const fieldMap = {
  Zk_Numer: ["Zk_Numer", "ZK_NUMER", "zk_numer", "ZK", "Nr_Zk", "Nr_ZK","NR_ZK","ZK_NUMRI","NUMRI_ZK"],
  Zk_Emer: ["Zk_Emer", "ZK_EMER", "zk_emer", "ZONA_EMER", "Emri_ZK","EMRI_I_ZK","EMRI_ZK","ZK_EMRI"],
  Nr_Pas: ["Nr_Pas","NR_PAS","NR_PASS","NR_PASURIE","NrPas","nr_pas","Numri_i_Pa","NR__PAS","NR__PASURI"],
  Vol: ["Vol", "VOL", "vol" , "Vol"],
  Faqe: ["Faqe", "FAQE", "faqe", "FQ","Faqe"],
  Pronaret: ["Pronaret", "PRONARET", "pronaret", "EMER_PRONA", "Emri_i_Pro","PRONESIA","Pronaret"],
  Kufizimet: ["Kufizimet","KUFIZIMET","kufizimet","KUFIZIM_E","KUFIZIM_D","TR_PERSH1","SHENIME_NE","Kufizimet"],
  Siperfaqe: ["Siperfaqe","SIPERFAQE","siperfaqe","AREA","SIPERFAQJA"],
};

function getFieldValue(props, keys) {
  if (!props) return "-";
  const lowerProps = Object.fromEntries(
    Object.entries(props).filter(([_, v]) => v != null && v !== "").map(([k, v]) => [k.toLowerCase(), v])
  );

  for (const k of keys) {
    const val = lowerProps[k.toLowerCase()];
    if (val) return val;
  }

  return "-";
}

/* ===================== MEMOIZED TABLE ===================== */
const DataTable = React.memo(({ data }) => (
  <div style={tableContainerStyle}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
      <thead>
        <tr>
          {["ZK", "Zona", "Nr. Pasurie", "Vol", "Faqe", "Pronarët", "Kufizimet", "Sipërfaqe"].map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
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
));

/* ===================== MAIN COMPONENT ===================== */
export default function Lista() {
  const [allData, setAllData] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [debouncedInput, setDebouncedInput] = useState("");

  useEffect(() => {
    const files = [
       "PE2239KO_P.geojson","PR1088BA_P.geojson",  "PR3131RA_P.geojson","SR2806NI_N.geojson",
       "PR3067PS_N.geojson", "PR3067PS_P.geojson","VL2955PI_N.geojson","VL2955PI_P.geojson",
        "MK2350KU_N.geojson","MK2350KU_P.geojson","EL3376SH_N.geojson","EL3376SH_P.geojson",
        "PE1361CA_N.geojson","PE1361CA_P.geojson","PE1084BA_N.geojson", "PE1084BA_P.geojson",
        "LU2238KS_P.geojson","EL1885GU_N.geojson","EL1885GU_P.geojson","PR2216KO_N.geojson",
        "PR2216KO_P.geojson", "LU8573LU_N.geojson", "LU8573LU_P.geojson"
     

    ].map(f => import.meta.env.BASE_URL + "geojson/" + f);

    const loadFiles = async () => {
      try {
        const promises = files.map((url) => fetch(url).then(res => res.ok ? res.json() : null).catch(() => null));
        const results = await Promise.all(promises);

        const allFeatures = results.flatMap((data) => {
          if (!data || !data.features) return [];
          return data.features.map((feat) => {
            const p = feat.properties || {};
            const zkNumer = getFieldValue(p, fieldMap.Zk_Numer);
            if (!isWithinDateRange(zkNumer)) return null;

            const zkEmer = getFieldValue(p, fieldMap.Zk_Emer) || "MLIZ";
            const pronaret = getFieldValue(p, fieldMap.Pronaret);
            const kufizimetCombined = [getFieldValue(p, ["KUFIZIM_E"]), getFieldValue(p, ["KUFIZIM_D"]), getFieldValue(p, fieldMap.Kufizimet)].filter(v => v && v !== "-").join(" | ");

            const siperfaqe = (() => {
              const val = getFieldValue(p, fieldMap.Siperfaqe);
              return val ? Math.round(Number(val) * 100) / 100 + " m²" : "-";
            })();

            return {
              Zk_Numer: zkNumer,
              Zk_Emer: zkEmer,
              Nr_Pas: getFieldValue(p, fieldMap.Nr_Pas),
              Vol: getFieldValue(p, fieldMap.Vol),
              Faqe: getFieldValue(p, fieldMap.Faqe),
              Pronaret: pronaret,
              Kufizimet: kufizimetCombined,
              Siperfaqe: siperfaqe,
              _searchText: `${zkEmer} ${pronaret} ${kufizimetCombined}`.toLowerCase(),
            };
          }).filter(Boolean);
        });

        setAllData(allFeatures);
      } catch (err) {
        console.error("Error loading files:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  /* ===================== SEARCH DEBOUNCE ===================== */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(searchInput), 180);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredResults = useMemo(() => {
    const query = (searchValue || debouncedInput).trim().toLowerCase();
    return allData.filter((row) => isWithinDateRange(row.Zk_Numer) && (!query || row._searchText.includes(query)));
  }, [allData, searchValue, debouncedInput]);

  const handleSearch = () => setSearchValue(searchInput.trim().toLowerCase());

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ marginBottom: "15px", color: "black" }}>Kërko pasuri sipas listës</h2>
        <button onClick={() => (window.location.hash = "#/")} className="back-button">
          <ArrowLeft size={18} /><span className="btn-text">Kthehu</span>
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Kërko sipas Pronarit :"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1, padding: "10px", background: "#fff", color: "#000", border: "1px solid #ccc", borderRadius: "4px" }}
        />
        <button onClick={handleSearch} style={{ padding: "10px 18px", backgroundColor: "#004aad", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
          Kërko
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#004aad" }}>
          <strong>⏳ Duke ngarkuar të dhënat...</strong>
        </div>
      ) : (
        <>
          <DataTable data={filteredResults} />
          {searchValue && filteredResults.length === 0 && (
            <p style={{ color: "red", marginTop: "10px" }}>Nuk u gjet asnjë rezultat ose afati i afishimit ka përfunduar!</p>
          )}
        </>
      )}
    </div>
  );
}