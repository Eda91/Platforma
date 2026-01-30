import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";

// Fix marker icons for GitHub Pages
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: import.meta.env.BASE_URL + "images/marker-icon-2x.png",
  iconUrl: import.meta.env.BASE_URL + "images/marker-icon.png",
  shadowUrl: import.meta.env.BASE_URL + "images/marker-shadow.png",
});
// Helper to check valid polygons
function isValidPolygonGeometry(g) {
  return (
    g &&
    ((g.type === "Polygon" && g.coordinates?.[0]?.length >= 4) ||
      (g.type === "MultiPolygon" && g.coordinates?.[0]?.[0]?.length >= 4))
  );
}

// Extract owners from text
function extractOwnersFromPronaret(text = "") {
  return text
    .split(",")
    .map((o) => {
      const parts = o.trim().split(" ");
      if (parts.length >= 2) return (parts[0] + " " + parts[1]).toLowerCase();
      return null;
    })
    .filter(Boolean);
}


// Table styles
const thStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };
const tdStyle = {
  border: "1px solid #ddd",
  padding: "6px",
  verticalAlign: "top",
};

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
  const [allData, setAllData] = useState([]);

  // Load GeoJSONs
  useEffect(() => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    const map = L.map(mapContainer, { preferCanvas: true }).setView(
      [41.0, 20.0],
      7.5,
    );
    mapRef.current = map;

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ).addTo(map);

    labelLayerRef.current = L.layerGroup().addTo(map);

    const baseStyle = { color: "#ff9800", weight: 1, fillOpacity: 0.2 };
  const files = [
  import.meta.env.BASE_URL + "geojson/loti5.geojson",
  import.meta.env.BASE_URL + "geojson/loti6.geojson",
];


    Promise.all(files.map((f) => fetch(f).then((r) => r.json())))
      .then((datasets) => {
        const allFeatures = datasets.flatMap((d) => d.features || []);
        const validFeatures = allFeatures.filter((f) =>
          isValidPolygonGeometry(f.geometry),
        );

        validFeatures.forEach((f) => {
          const p = f.properties || {};
          f.zk = (p.Zk_Numer ?? "").trim();
          f.owners = extractOwnersFromPronaret(p.Pronaret ?? "");
          f._layer = null;

          const bounds = L.geoJSON(f).getBounds();
          f._label = L.marker(bounds.getCenter(), {
            interactive: true,
            icon: L.divIcon({
              className: "parcel-label",
              html: p.Nr_Pas ?? "-",
            }),
          });

          f._label.on("click", () => {
            L.popup()
              .setLatLng(bounds.getCenter())
              .setContent(
                `
                <div>
                  <div><strong>ZK:</strong> ${p.Zk_Numer ?? "-"}</div>
                  <div><strong>Nr. Pasurie:</strong> ${p.Nr_Pas ?? "-"}</div>
                  <div><strong>Pronarët:</strong> ${p.Pronaret ?? "-"}</div>
                  <div><strong>Sipërfaqe:</strong> ${p.Siperfaqe ?? "-"}</div>
                </div>
              `,
              )
              .openOn(map);
          });
        });

        featuresRef.current = validFeatures;
        setAllData(validFeatures.map((f) => f.properties));

        if (validFeatures.length > 0) {
          L.geoJSON(validFeatures, {
            style: baseStyle,
            smoothFactor: 1.5,
            onEachFeature: (feature, layer) => (feature._layer = layer),
          }).addTo(map);
        }
      })
      .catch(console.error);

    // Label update
    let timeout = null;
    const updateLabels = () => {
      if (timeout) return;
      timeout = setTimeout(() => {
        labelLayerRef.current.clearLayers();
        if (map.getZoom() >= 9) {
          const bounds = map.getBounds();
          featuresRef.current.forEach((f) => {
            if (f._layer && bounds.contains(f._layer.getBounds().getCenter())) {
              labelLayerRef.current.addLayer(f._label);
            }
          });
        }
        timeout = null;
      }, 50);
    };
    map.on("zoomend moveend", updateLabels);

    return () => map.remove();
  }, []);

  // Handle search
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
        ? f.owners.some((o) => o.toLowerCase().includes(ownerVal))
        : true;
      return zkMatch && ownerMatch;
    });

    if (!matches.length) {
      setMessage("Nuk u gjet asnjë pasuri");
      setResults([]);
      setShowResultsModal(false);
      return;
    }

    setMessage("");
    setResults(matches.map((f) => f.properties));
    setShowResultsModal(true);

    matches.forEach(
      (f) =>
        f._layer &&
        f._layer.setStyle({ color: "red", weight: 3, fillOpacity: 0.5 }),
    );

    mapRef.current.fitBounds(
      L.featureGroup(matches.map((f) => f._layer)).getBounds(),
      { maxZoom: 18 },
    );
  };

  // Drag modal
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      {/* MAP AND SIDEBAR */}
      <div style={{ display: "flex", flex: 1 }}>
        <div
          className="sidebar"
          style={{ width: "350px", overflowY: "auto", padding: "10px" }}
        >
          <img src={import.meta.env.BASE_URL + "images/logo.jpg"} style={{width:"320px"}}alt="Logo" />

          <p>
            Faza e Afishimit Publik për procesin e Regjistrimit Fillestar zgjat
            për 45 ditë nga momenti i publikimit.
          </p>
          <p style={{ fontSize: "12px" }}>
            Ju mund të konsultoni afishimet fizikisht edhe pranë Njësisë
            Administrative përkatëse. Për çdo paqartësi, pretendim apo kërkesë
            për saktësim, mund të paraqisni një kërkesë me shkrim pranë zyrave
            ku është kryer afishimi publik brenda afatit 45 ditor.
          </p>
          <div
            style={{
              maxWidth: "380px",
              margin: "20px auto",
              padding: "20px",
              backgroundColor: "#ffffff",
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
              required
              onChange={(e) => setZk(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "4px", // smaller gap before message
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            />
            {/* Message for Zona Kadastrale */}
            {!zk && (
              <div
                style={{ color: "red", fontSize: "13px", marginBottom: "12px" }}
              >
                Ju lutem vendosni Zonen Kadastrale
              </div>
            )}

            <input
              placeholder="Emri dhe Mbiemri i Pronarit *"
              value={owner}
              required
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
            {/* Message for Emri dhe Mbiemri */}
            {!owner && (
              <div
                style={{ color: "red", fontSize: "13px", marginBottom: "18px" }}
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

          {/* OPEN NEW PAGE */}
          <button
            onClick={() => window.open("/lista", "_blank")}
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

        <div id="map" style={{ flex: 1 }} />
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
          Të gjitha të drejtat e rezervuara për &#169; Agjencinë Shtetërore të
          Kadastrës
        </p>
      </footer>

      {/* SEARCH RESULTS MODAL */}
      {showResultsModal && (
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
                    style={{ background: idx % 2 ? "#fafafa" : "#fff" }}
                  >
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
        </div>
      )}
    </div>
  );
}
