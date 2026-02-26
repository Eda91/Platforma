import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";

/* FIX MARKER ICONS */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: import.meta.env.BASE_URL + "images/marker-icon-2x.png",
  iconUrl: import.meta.env.BASE_URL + "images/marker-icon.png",
  shadowUrl: import.meta.env.BASE_URL + "images/marker-shadow.png",
});

/* HELPERS */
function isValidPolygonGeometry(g) {
  return g && (g.type === "Polygon" || g.type === "MultiPolygon");
}

function extractOwnersFromPronaret(text = "") {
  return text
    .split(",")
    .map((o) => {
      const p = o.trim().split(" ");
      return p.length >= 2 ? (p[0] + " " + p[1]).toLowerCase() : null;
    })
    .filter(Boolean);
}

/* TABLE STYLES */
const thStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };
const tdStyle = {
  border: "1px solid #ddd",
  padding: "6px",
  verticalAlign: "top",
};

/* FIELD MAP - fleksibël për JSON të ndryshme */
const fieldMap = {
  Zk_Numer: ["Zk_Numer", "ZK_NUMER", "zk_numer", "ZK"],
  Zk_Emer: ["Zk_Emer", "ZK_EMER", "zk_emer", "ZONA_EMER"],
  Nr_Pas: ["Nr_Pas", "NR_PAS", "NR_PASURIE", "NrPas", "nr_pas"],
  Vol: ["Vol", "VOL", "vol"],
  Faqe: ["Faqe", "FAQE", "faqe"],
  Pronaret: ["Pronaret", "PRONARET", "pronaret", "EMER_PRONA"],
  Kufizimet: ["Kufizimet", "KUFIZIMET", "kufizimet", "KUFIZIM_E", "KUFIZIM_D"],
  Siperfaqe: ["Siperfaqe", "SIPERFAQE", "siperfaqe", "AREA"],
};

/* HELPER TO GET FIELD VALUE */
function getFieldValue(obj, keys) {
  if (!obj) return undefined;
  if (!Array.isArray(keys)) keys = [keys];

  for (let key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

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
};

function isWithinDateRange(zkNumer) {
  const rule = afatetZK[zkNumer];
  if (!rule) return true;

  const today = new Date();
  return today >= new Date(rule.start) && today <= new Date(rule.end);
}

export default function MapView() {
  const mapRef = useRef(null);
  const labelLayerRef = useRef(null);
  const featuresRef = useRef([]);

  const [zk, setZk] = useState("");
  const [owner, setOwner] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const modalRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  // At the top of your component
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    return window.innerWidth >= 768; // ✅ true për desktop, false për mobile
  });
  const isMobile = window.innerWidth < 768;

  const ALBANIA_BOUNDS = L.latLngBounds(
    [39.6, 19.1], // SW
    [42.7, 21.1], // NE
  );

  /* ================= MAP INIT ================= */
  useEffect(() => {
    if (mapRef.current) return;

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    const map = L.map(mapContainer, {
      preferCanvas: false,
      maxBounds: ALBANIA_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 7,
      maxZoom: 19,
      zoomSnap: 0.15,
      zoomDelta: 0.15,
    }).setView([41.1, 20.1], 7.7);

    mapRef.current = map;

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ).addTo(map);

    labelLayerRef.current = L.layerGroup().addTo(map);

    const parcelStyle = { color: "#ff9800", weight: 1, fillOpacity: 0.25 };
    const buildingStyle = { color: "green", weight: 1, fillOpacity: 0.5 };

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
    ];

    Promise.all(
      files.map((f) =>
        fetch(f.url)
          .then((r) => r.json())
          .then((data) => ({ ...f, data })),
      ),
    ).then((layers) => {
      const allFeatures = [];

      layers.forEach(({ data, type }) => {
        const validFeatures = (data.features || []).filter((f) => {
          if (!isValidPolygonGeometry(f.geometry)) return false;

          const props = f.properties || {};

          const zk = getFieldValue(props, fieldMap.Zk_Numer)?.toString().trim();

          return isWithinDateRange(zk); // 🔥 inactive disappears completely
        });

        L.geoJSON(validFeatures, {
          style: type === "building" ? buildingStyle : parcelStyle,

          onEachFeature: (feature, layer) => {
            feature._layer = layer;
            feature.type = type;

            const props = feature.properties || {};

            // Normalized properties me fallback për Zk_Emer
            feature.normalized = {
              Zk_Numer: getFieldValue(props, fieldMap.Zk_Numer),
              Zk_Emer: getFieldValue(props, fieldMap.Zk_Emer) || "MLIZ", // fallback këtu
              Nr_Pas: getFieldValue(props, fieldMap.Nr_Pas),
              Vol: getFieldValue(props, fieldMap.Vol),
              Faqe: getFieldValue(props, fieldMap.Faqe),
              Pronaret: getFieldValue(props, fieldMap.Pronaret),
              Kufizimet: [
                getFieldValue(props, ["KUFIZIM_E"]),
                getFieldValue(props, ["KUFIZIM_D"]),
                getFieldValue(props, fieldMap.Kufizimet),
              ]
                .filter((v) => v && v !== "-")
                .join(" | "),
              Siperfaqe: getFieldValue(props, fieldMap.Siperfaqe),
            };

            // Unified property extraction me fallback
            feature.zk =
              getFieldValue(props, fieldMap.Zk_Numer)?.toString().trim() || "-";
            // 🔒 RESTRICTION NGA DATA
            feature.isActive = isWithinDateRange(feature.zk);
            feature.nrPas = getFieldValue(props, fieldMap.Nr_Pas) || "-";
            feature.owners = extractOwnersFromPronaret(
              getFieldValue(props, fieldMap.Pronaret) || "-",
            );

            // Fallback për Zk_Emer në debug
            const zkEmerValue =
              getFieldValue(props, fieldMap.Zk_Emer) || "MLIZ";
            console.log("ZK EMER:", zkEmerValue);

            // LABELS
            if (
              (type === "parcel" || type === "building") &&
              feature.nrPas !== "-" &&
              layer.getBounds
            ) {
              try {
                const bounds = layer.getBounds();
                if (bounds && bounds.isValid()) {
                  const center = bounds.getCenter();
                  let offsetY = type === "building" ? 12 : 0;

                  feature._label = L.marker(center, {
                    interactive: false,
                    icon: L.divIcon({
                      className: "parcel-label",
                      html: `<div style="font-size:12px;font-weight:bold;white-space:nowrap;color:black;">${feature.nrPas}</div>`,
                      iconSize: [0, 0],
                      iconAnchor: [0, 0],
                    }),
                  });
                }
              } catch (e) {}
            }

            // CLICK POPUP
            layer.on("click", () => {
              let popupHtml = "";
              for (const key in feature.normalized) {
                popupHtml += `<b>${key.replace("_", " ")}:</b> ${feature.normalized[key]}<br/>`;
              }
              layer.bindPopup(popupHtml || "Nuk ka të dhëna").openPopup();
            });

            allFeatures.push(feature);
          },
        }).addTo(map);
      });

      featuresRef.current = allFeatures;
      updateLabels();
    });

    /* ===== LABEL UPDATE ==== */
    let timeout = null;

    function updateLabels() {
      if (!labelLayerRef.current) return;

      if (timeout) return;
      timeout = setTimeout(() => {
        labelLayerRef.current.clearLayers();

        if (map.getZoom() >= 14) {
          const bounds = map.getBounds();

          featuresRef.current.forEach((f) => {
            if (
              f._layer &&
              f._label &&
              bounds.contains(f._layer.getBounds().getCenter())
            ) {
              labelLayerRef.current.addLayer(f._label);
            }
          });
        }

        timeout = null;
      }, 50);
    }

    map.on("zoomend moveend", updateLabels);

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ================= SEARCH ================= */
  const handleSearch = () => {
    const zkVal = zk.trim().toLowerCase();
    const ownerVal = owner.trim().toLowerCase();

    if (!zkVal && !ownerVal) {
      setMessage("Vendos një kriter kërkimi");
      setResults([]);
      setShowResultsModal(false);
      return;
    }

    const baseStyle = { color: "#ff9800", weight: 1, fillOpacity: 0.2 };
    featuresRef.current.forEach(
      (f) => f._layer && f._layer.setStyle(baseStyle),
    );

    const matches = featuresRef.current.filter((f) => {
      if (!f._layer) return false;
      const zkMatch = zkVal ? f.zk.toLowerCase().includes(zkVal) : true;
      const ownerMatch = ownerVal
        ? f.owners.some((o) => o.includes(ownerVal))
        : true;
      return zkMatch && ownerMatch;
    });

    if (!matches.length) {
      setMessage(
        "Nuk u gjet asnjë pasuri ose afati i afishimit ka përfunduar.",
      );
      setResults([]);
      setShowResultsModal(false);
      return;
    }

    setMessage("");
    setResults(matches.map((f) => f.normalized));
    setShowResultsModal(true);

    matches.forEach(
      (f) =>
        f._layer &&
        f._layer.setStyle({ color: "red", weight: 3, fillOpacity: 0.5 }),
    );

    const group = L.featureGroup(matches.map((f) => f._layer));

    mapRef.current.flyToBounds(group.getBounds(), {
      maxZoom: 18,
      duration: 1.2,
      easeLinearity: 0.25,
      padding: [30, 30],
    });

    if (isMobile) setSidebarVisible(false);
    matches.forEach((f) => {
      f._layer.setStyle({ color: "red", weight: 3, fillOpacity: 0.5 });

      if (isMobile) {
        let html = "";
        for (const k in f.normalized) {
          html += `<b>${k}:</b> ${f.normalized[k]}<br/>`;
        }
        f._layer.bindPopup(html).openPopup();
      }
    });

    if (!isMobile) {
      setResults(matches.map((f) => f.normalized));
      setShowResultsModal(true);
    }
  };

  /* ================= MODAL DRAG ================= */
  const onMouseDown = (e) => {
    dragging.current = true;
    const rect = modalRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    modalRef.current.style.left = `${e.clientX - dragOffset.current.x}px`;
    modalRef.current.style.top = `${e.clientY - dragOffset.current.y}px`;
  };
  const onMouseUp = () => (dragging.current = false);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  /* ================= RENDER ================= */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <button
        id="menu-toggle"
        className="menu-btn"
        onClick={() => setSidebarVisible((prev) => !prev)}
      >
        ☰
      </button>
      {/* MAP AND SIDEBAR */}
      <div id="app-container" style={{ display: "flex", flex: 1 }}>
        {/* SIDEBAR */}
        {sidebarVisible && (
          <div
            className={`sidebar ${sidebarVisible ? "open" : ""}`}
            style={{
              width: "350px",
              overflowY: "auto",
              padding: "10px",
              transition: "transform 0.3s ease",
              zIndex: 2000,
            }}
          >
            <img
              src={import.meta.env.BASE_URL + "images/logo.jpg"}
              style={{ width: "320px" }}
              alt="Logo"
            />

            <p>
              Afishimit Publik kryhet sipas ligjit 111/2018  "Për Kadastrën".
              Faza e për procesin e Regjistrimit Fillestar zgjat për 45 ditë nga
              momenti i publikimit.
            </p>

            <p style={{ fontSize: "12px" }}>
              Ju mund të konsultoni afishimet fizikisht edhe pranë Njësisë
              Administrative përkatëse.
            </p>

            {/* SEARCH CARD */}
            <div
              style={{
                maxWidth: "380px",
                margin: "20px auto",
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
              }}
            >
              <h3 style={{ textAlign: "center", marginBottom: "16px" }}>
                Kërko Pasuri
              </h3>

              <input
                placeholder="Zona Kadastrale *"
                value={zk}
                onChange={(e) => setZk(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "4px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              />
              {!zk && (
                <div
                  style={{
                    color: "red",
                    fontSize: "13px",
                    marginBottom: "12px",
                  }}
                >
                  Ju lutem vendosni Zonen Kadastrale
                </div>
              )}

              <input
                placeholder="Emri dhe Mbiemri i Pronarit *"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "4px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              />
              {!owner && (
                <div
                  style={{
                    color: "red",
                    fontSize: "13px",
                    marginBottom: "18px",
                  }}
                >
                  Ju lutem vendosni Emrin dhe Mbiemrin e Pronarit
                </div>
              )}

              <div style={{ textAlign: "center" }}>
                <button
                  onClick={handleSearch}
                  disabled={!zk || !owner}
                  style={{
                    width: "140px",
                    padding: "10px",
                    backgroundColor: !zk || !owner ? "#b5c7e6" : "#004aad",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: !zk || !owner ? "not-allowed" : "pointer",
                  }}
                >
                  🔍 Kërko
                </button>
              </div>
            </div>
            {message && (
              <div
                style={{
                  color: "darkred",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {message}
              </div>
            )}

            {/* OPEN NEW PAGE */}
            <button
              onClick={() => (window.location.hash = "#/lista")}
              style={{
                marginTop: "14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#f0f6ff",
                color: "#004aad",
                border: "1px solid #cfe0ff",
                borderRadius: "8px",
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e3eeff";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f0f6ff";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              🔍 Kërko emrin tënd në listë
            </button>
          </div>
        )}
        {/* MAP */}
        <div id="map" style={{ flex: 1, height: "100vh" }} />
      </div>

      {/* FOOTER */}
      <footer
        style={{
          backgroundColor: "#1e293b",
          color: "white",
          textAlign: "center",
          padding: "7px 0",
          fontSize: "14px",
          marginTop: "auto",
          width: "100%",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            fontStyle: "italic",
            color: "white",
          }}
        >
          Të gjitha të drejtat e rezervuara për © Agjencinë Shtetërore të
          Kadastrës
        </p>
      </footer>

      {/* SEARCH RESULTS MODAL */}
      {showResultsModal && !isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 9999,
          }}
        >
          <div
            ref={modalRef}
            onMouseDown={onMouseDown}
            style={{
              position: "absolute",
              top: "120px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "700px",
              maxHeight: "75%",
              backgroundColor: "#fff",
              borderRadius: "10px",
              padding: "15px",
              overflow: "auto",
              boxShadow: "0 8px 25px rgba(0,0,0,0.35)",
              cursor: "move",
              color: "#000",
            }}
          >
            <button
              onClick={() => setShowResultsModal(false)}
              style={{
                position: "absolute",
                top: "8px",
                right: "10px",
                border: "none",
                background: "transparent",
                fontSize: "18px",
                cursor: "pointer",
                fontWeight: "bold",
                color: "black",
              }}
            >
              ✕
            </button>
            <h3 style={{ marginBottom: "10px" }}>Rezultatet e Kërkimit</h3>
            <div className="table-wrapper">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
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
                  {results.map((r, idx) => (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 ? "#fafafa" : "#fff",
                        marginBottom: "10px",
                      }}
                    >
                      <td style={tdStyle} data-label="ZK">
                        {r.Zk_Numer}
                      </td>
                      <td style={tdStyle} data-label="Zona">
                        {r.Zk_Emer}
                      </td>
                      <td style={tdStyle} data-label="Nr. Pasurie">
                        {r.Nr_Pas}
                      </td>
                      <td style={tdStyle} data-label="Vol">
                        {r.Vol}
                      </td>
                      <td style={tdStyle} data-label="Faqe">
                        {r.Faqe}
                      </td>
                      <td style={tdStyle} data-label="Pronarët">
                        {r.Pronaret}
                      </td>
                      <td style={tdStyle} data-label="Kufizimet">
                        {r.Kufizimet}
                      </td>
                      <td style={tdStyle} data-label="Sipërfaqe">
                        {r.Siperfaqe}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
