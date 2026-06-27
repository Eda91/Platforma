import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import polylabel from "@mapbox/polylabel";
import * as turf from "@turf/turf";
import { trackZkSearch } from "../api/analytics";
import afatetZK from "../src/config/afatetZK.json";
import { uploadStats } from "../api/firebaseAnalytics";
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
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
}

function getPolygonCenter(feature) {
  if (!feature || !feature.geometry) return null;

  const coords = feature.geometry.coordinates;

  // Për Leaflet me GeoJSON, shapet janë zakonisht [ [lng, lat], ... ]
  // Marrim mesataren e të gjitha points si approximation
  let sumLat = 0,
    sumLng = 0,
    count = 0;

  coords[0].forEach(([lng, lat]) => {
    sumLat += lat;
    sumLng += lng;
    count++;
  });

  return count ? L.latLng(sumLat / count, sumLng / count) : null;
}

/* FIELD MAP - fleksibël për JSON të ndryshme */
const fieldMap = {
  Zk_Numer: [
    "Zk_Numer",
    "ZK_NUMER",
    "zk_numer",
    "ZK",
    "Nr_Zk",
    "Nr_ZK",
    "NR_ZK",
    "ZK_NUMRI",
    "NUMRI_ZK",
  ],
  Zk_Emer: [
    "Zk_Emer",
    "ZK_EMER",
    "zk_emer",
    "ZONA_EMER",
    "Emri_ZK",
    "EMRI_I_ZK",
    "EMRI_ZK",
    "ZK_EMRI",
  ],
  Nr_Pas: [
    "Nr_Pas",
    "NR_PAS",
    "NR_PASS",
    "NR_PASURIE",
    "NrPas",
    "nr_pas",
    "Numri_i_Pa",
    "NR__PAS",
    "NR__PASURI",
    "Nr_Pas",
  ],
  Vol: ["Vol", "VOL", "vol", "Vol"],
  Faqe: ["Faqe", "FAQE", "faqe", "FQ", "Faqe"],
  Pronaret: [
    "Pronaret",
    "PRONARET",
    "pronaret",
    "EMER_PRONA",
    "Emri_i_Pro",
    "PRONESIA",
    "Pronaret",
  ],
  Kufizimet: [
    "Kufizimet",
    "KUFIZIMET",
    "kufizimet",
    "KUFIZIM_E",
    "KUFIZIM_D",
    "TR_PERSH1",
    "SHENIME_NE",
    "Kufizimet",
  ],
  Siperfaqe: ["Siperfaqe", "SIPERFAQE", "siperfaqe", "AREA", "SIPERFAQJA"],
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

function getFeatureCenter(feature) {
  const layer = feature._layer;

  try {
    if (feature.geometry.type === "Polygon") {
      return L.latLng(polylabel(feature.geometry.coordinates, 1).reverse());
    }

    if (feature.geometry.type === "MultiPolygon") {
      // take largest polygon
      const polygons = feature.geometry.coordinates;

      let largest = polygons[0];
      let maxArea = 0;

      polygons.forEach((p) => {
        const area = L.polygon(p[0]).getBounds().getArea?.() || 0;
        if (area > maxArea) {
          maxArea = area;
          largest = p;
        }
      });

      return L.latLng(polylabel(largest, 1).reverse());
    }

    return layer.getBounds().getCenter();
  } catch (e) {
    return layer?.getBounds().getCenter();
  }
}

const afatet= {

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
  2216: { start: "2026-06-18", end: "2026-08-01" },



};

function isWithinDateRange(zkNumer) {
  const rule = afatet[zkNumer];
  if (!rule) return true;

  const today = new Date();
  return today >= new Date(rule.start) && today <= new Date(rule.end);
}


function normalizeText(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // heq thekset
    .replace(/\s+/g, " ");           // heq hapësirat e tepërta
}

export default function MapView() {
  const mapRef = useRef(null);
  const labelLayerRef = useRef(null);
  const featuresRef = useRef([]);

  const [zk, setZk] = useState("");
  const [owner, setOwner] = useState("");
  const [message, setMessage] = useState("");
  const [nrPas, setNrPas] = useState("");
  const [results, setResults] = useState([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const modalRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const [fshati, setFshati] = useState("");
  const zkIndexRef = useRef({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [afatetZKState, setAfatetZKState] = useState({});

  const [sidebarVisible, setSidebarVisible] = useState(() => {
    return window.innerWidth >= 768;
  });
  const isMobile = window.innerWidth < 768;
  const thStyle = {
    border: "1px solid #e2e8f0",
    padding: "8px",
    textAlign: "left",
    fontWeight: "600",
    backgroundColor: "#f1f5f9",
  };

  const tdStyle = {
    border: "1px solid #e2e8f0",
    padding: "8px",
  };
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
      preferCanvas: true,
      renderer: L.canvas(),
      maxBounds: ALBANIA_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 7.7,
      maxZoom: 18,
      zoomSnap: 0.15,
      zoomDelta: 0.15,
    }).setView([41.1, 20.1], 7.8);

    mapRef.current = map;

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ).addTo(map);

    labelLayerRef.current = L.layerGroup().addTo(map);

    const parcelStyle = { color: "#ff9800", weight: 1, fillOpacity: 0.25 };
    const buildingStyle = { color: "#008000", weight: 1, fillOpacity: 0.5 };
    const cityStyle = {
      color: "#c2410c",
      weight: 2,
      fillOpacity: 0,
      fillColor: "transparent",
    };
    const files = [
      {
        url: import.meta.env.BASE_URL + "geojson/gadm41_ALB_2.geojson",
        type: "city",
      },


      {
        url: import.meta.env.BASE_URL + "geojson/PE2239KO_P.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/PR1088BA_P.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/PR3131RA_P.geojson",
        type: "parcel",
      },
      {
        url: import.meta.env.BASE_URL + "geojson/SR2806NI_P.geojson",
        type: "parcel",
      },
      
       {
        url: import.meta.env.BASE_URL + "geojson/SR2806NI_N.geojson",
        type: "building",
      },
  
        {
        url: import.meta.env.BASE_URL + "geojson/PR3067PS_N.geojson",
        type: "building",
      },
       {
        url: import.meta.env.BASE_URL + "geojson/PR3067PS_P.geojson",
        type: "parcel",
      },

        {
        url: import.meta.env.BASE_URL + "geojson/VL2955PI_N.geojson",
        type: "building",
      },
       {
        url: import.meta.env.BASE_URL + "geojson/VL2955PI_P.geojson",
        type: "parcel",
      },

      {
        url: import.meta.env.BASE_URL + "geojson/MK2350KU_N.geojson",
        type: "building",
      },
       {
        url: import.meta.env.BASE_URL + "geojson/MK2350KU_P.geojson",
        type: "parcel",
      },

      {
      url: import.meta.env.BASE_URL + "geojson/EL3376SH_N.geojson",
      type: "building",
    },
    {
      url: import.meta.env.BASE_URL + "geojson/EL3376SH_P.geojson",
      type: "parcel",
    },

       {
      url: import.meta.env.BASE_URL + "geojson/PE1361CA_N.geojson",
      type: "building",
    },
    {
      url: import.meta.env.BASE_URL + "geojson/PE1361CA_P.geojson",
      type: "parcel",
    },
       {
      url: import.meta.env.BASE_URL + "geojson/PE1084BA_N.geojson",
      type: "building",
    },
    {
      url: import.meta.env.BASE_URL + "geojson/PE1084BA_P.geojson",
      type: "parcel",
    },
         {
      url: import.meta.env.BASE_URL + "geojson/EL1885GU_N.geojson",
      type: "building",
    },
    {
      url: import.meta.env.BASE_URL + "geojson/EL1885GU_P.geojson",
      type: "parcel",
    },
     {
      url: import.meta.env.BASE_URL + "geojson/LU2238KS_P.geojson",
      type: "parcel",
    },

          {
      url: import.meta.env.BASE_URL + "geojson/PR2216KO_N.geojson",
      type: "building",
    },
    {
      url: import.meta.env.BASE_URL + "geojson/PR2216KO_P.geojson",
      type: "parcel",
    },

    ];

    async function loadLayersSequentially() {
      const allFeatures = [];

      for (const f of files) {
        try {
          const res = await fetch(f.url);
          const data = await res.json();

          const validFeatures = (data.features || []).filter((feature) => {
            if (!feature || !feature.geometry) return false;

            const g = feature.geometry;

            if (!["Polygon", "MultiPolygon"].includes(g.type)) return false;

            if (!g.coordinates || !g.coordinates.length) return false;

            try {
              const first =
                g.type === "Polygon"
                  ? g.coordinates[0][0]
                  : g.coordinates[0][0][0];

              if (!Array.isArray(first) || first.length < 2) return false;

              if (isNaN(first[0]) || isNaN(first[1])) return false;
            } catch {
              return false;
            }

            const props = feature.properties || {};
            const zk = getFieldValue(props, fieldMap.Zk_Numer)
              ?.toString()
              .trim();

            return isWithinDateRange(zk);
          });

          try {
            L.geoJSON(validFeatures, {
              style: (feature) => {
                if (f.type === "city") return cityStyle;
                if (f.type === "building") return buildingStyle;

                return {
                  color: "#ff9800",
                  weight: 1.2,
                  fillColor: "#ff9800",
                  fillOpacity: 0.3,
                };
              },

              onEachFeature: (feature, layer) => {
                try {
                  feature._layer = layer;
                  layer.feature = feature;
                  feature.type = f.type;

                  const props = feature.properties || {};

                  feature.normalized = {
                    Zk_Numer: getFieldValue(props, fieldMap.Zk_Numer),
                    Zk_Emer: getFieldValue(props, fieldMap.Zk_Emer),
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
                    Siperfaqe: (() => {
                      const val = getFieldValue(props, fieldMap.Siperfaqe);
                      if (!val) return "-";
                      const num = Number(val);
                      return Math.round(num * 100) / 100 + " m²";
                    })(),
                  };

                  feature.zk =
                    getFieldValue(props, fieldMap.Zk_Numer)
                      ?.toString()
                      .trim() || "-";

                      if (feature.zk === "-" || feature.zk === "0") {
                          feature.isValidZk = false;
                        } else {
                          feature.isValidZk = true;
                        }

                        const zkKey = feature.zk;

                        if (zkKey && zkKey !== "-" && zkKey !== "0") {
                          if (!zkIndexRef.current[zkKey]) {
                            zkIndexRef.current[zkKey] = [];
                          }

                          zkIndexRef.current[zkKey].push(layer);
                        }

                  feature.isActive = isWithinDateRange(feature.zk);
                  feature.nrPas = getFieldValue(props, fieldMap.Nr_Pas) || "-";
                  feature.owners = extractOwnersFromPronaret(
                    getFieldValue(props, fieldMap.Pronaret) || "-",
                  );

                  let center = null;

                  try {
                    center = getFeatureCenter(feature);
                    feature._center = center;
                  } catch (e) {}

                  if (
                    center &&
                    (f.type === "parcel" || f.type === "building")
                  ) {
                    feature._label = L.marker(center, {
                      interactive: false,
                      icon: L.divIcon({
                        className: "parcel-label",
                        html: `<div style="font-size:12px;color:#000;">${feature.nrPas}</div>`,
                      }),
                    });
                  }

                    if (center && f.type === "parcel") {

                      let offsetLat = 0;
                      let offsetLng = 0;

                     
                      if (feature.zk === "1088") {
                        offsetLng = -0.031; // adjust this value if needed
                      }
                        if (feature.zk === "3067") {
                        offsetLng = -0.005; // adjust this value if needed
                      }

                        if (feature.zk === "2806") {
                        offsetLng = -0.04; // adjust this value if needed
                        offsetLat = +0.02; 
                      }

                        if (feature.zk === "2955") {
                        offsetLng = -0.02; // adjust this value if needed
                      
                      }
                      
                        if (feature.zk === "1084") {
                        offsetLat = +0.02; 
                      }
                        if (feature.zk === "1361") {
                        offsetLng = -0.005; // adjust this value if needed
                      }

                        if (feature.zk === "3367") {
                        offsetLng = -0.04; // adjust this value if needed
                        offsetLat = +0.02; 
                      }
                          if (!feature.zk || feature.zk === "-" || feature.zk === "0") return;
                     

                      const shiftedCenter = L.latLng(
                        center.lat + offsetLat,
                        center.lng + offsetLng
                      );

                      feature._zkLabel = L.marker(shiftedCenter, {
                        interactive: false,
                        icon: L.divIcon({
                          className: "zk-label",
                          iconSize: [0, 0],
                          iconAnchor: [0, 0],
                          html: `
                            <div class="zk-text">
                              ${feature.zk}
                            </div>
                          `,
                        }),
                      });
                    }

                  if (center && f.type === "city") {
                    const cityName =
                      feature.properties?.NAME_2 ||
                      feature.properties?.NAME_1 ||
                      "City";

                    feature._label = L.marker(center, {
                      interactive: false,
                      icon: L.divIcon({
                        className: "city-label",
                        html: `<div style="font-size:9px;font-weight:600;margin-left:-10px">${cityName}</div>`,
                      }),
                    });
                  }

                  layer.on("click", () => {
                    let popupHtml = "";
                    for (const key in feature.normalized) {
                      popupHtml += `<b>${key.replace("_", " ")}:</b> ${feature.normalized[key]}<br/>`;
                    }
                    layer.bindPopup(popupHtml || "Nuk ka të dhëna").openPopup();
                  });

                  allFeatures.push(feature);
                } catch (e) {
                  console.warn("⚠️ skip feature");
                }
              },
            }).addTo(map);
          } catch (e) {
            console.warn("⛔ skip file:", f.url);
          }

          // ⏱ prevents freezing
          await new Promise((r) => setTimeout(r, 30));
        } catch (err) {
          console.error("Error loading:", f.url, err);
        }
      }

      featuresRef.current = allFeatures;
      updateLabels();
    }
    let renderedZK = new Set();
   let timeout;

    function updateLabels() {
      if (!labelLayerRef.current) return;

      if (!mapRef.current) return;
        if (!mapRef.current._container) return;
        if (!mapRef.current._loaded) return;

      if (timeout) return;

      timeout = setTimeout(() => {
        labelLayerRef.current.clearLayers();
        renderedZK.clear();

     // const bounds = map.getBounds();
            const map = mapRef.current;

        // 🔒 HARD GUARD
        if (!map || !map._container || !map._loaded) return;

        let bounds;
        try {
          bounds = map.getBounds();
          if (!bounds || !bounds.isValid()) return;
        } catch (e) {
          return; // map është në teardown ose invalid state
        }

        const zoom = map.getZoom();

        featuresRef.current.forEach((f) => {
          if (!f._layer || !f._center) return;
          const center = f._center;

          // 🚀 mos rendero jashtë ekranit (SUPER IMPORTANT)
          if (!bounds.contains(center)) return;

          // 🟥 CITY LABELS
          if (f.type === "city" && zoom >= 6) {
            if (f._label) labelLayerRef.current.addLayer(f._label);
          }

          // 🟦 ZK LABEL (vetëm një herë për zonë)
          if (f.type === "parcel" && zoom >= 10 && zoom <= 14) {
            if (!renderedZK.has(f.zk)) {
              renderedZK.add(f.zk);

              if (f._zkLabel) {
                labelLayerRef.current.addLayer(f._zkLabel);
              }
            }
          }

          // 🟧 NR PASURIE (vetëm zoom i lartë)
          if ((f.type === "parcel" || f.type === "building") && zoom >= 15) {
            if (f._label) labelLayerRef.current.addLayer(f._label);
          }
        });

    timeout = null;
      }, 80); // pak më i butë → më smooth
    }

    loadLayersSequentially();
    map.whenReady(() => {
      updateLabels();
    });

    map.on("zoomend moveend", updateLabels);

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const zoomToZK = (zkValue) => {
  if (!mapRef.current) return;

  const layers = zkIndexRef.current[zkValue];

  if (!layers || !layers.length) return;

  const group = L.featureGroup(layers);

  mapRef.current.fitBounds(group.getBounds(), {
    padding: [40, 40],
    maxZoom: 16,
  });

  // highlight
  layers.forEach((l) => {
    l.setStyle?.({
      color: "red",
      weight: 3,
      fillOpacity: 0.6,
    });
  });
};

const normalize = (str) =>
  str
    ?.toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

    const afatetIndex = Object.entries(afatetZK).reduce((acc, [zk, val]) => {
  acc[normalizeText(val.name)] = zk;
  return acc;
}, {});

const findZkByFshati = (fshati) => {
  const input = normalizeText(fshati);
  return afatetIndex[input] || null;
};


const trackSearch = async ({ zk, owner, fshati, resultCount }) => {

console.log("TRACK SEARCH CALLED:", { zk, owner, fshati, resultCount });

  try {
    if (!zk || zk === "-" || zk === "0") return; // ✅ STOP INVALID ZK

    const existing = JSON.parse(localStorage.getItem("zkClicks") || "{}");

    const key = zk.trim(); // ✅ CLEAN KEY

    existing[key] = (existing[key] || 0) + 1;

    localStorage.setItem("zkClicks", JSON.stringify(existing));

    window.dispatchEvent(new Event("zkClicksUpdated"));
 

    uploadStats(existing);

    await trackZkSearch({
      zk,
      owner,
      fshati,
      resultCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(err);
  }
};

  /* ================= SEARCH ================= */
const handleSearch = () => {
const zkVal = normalizeText(zk);
const ownerVal = normalizeText(owner);
const fshatiVal = normalizeText(fshati);

  if (!zkVal && !ownerVal && !fshatiVal) {
    setMessage("Vendos të paktën një kriter kërkimi");
    setResults([]);
    setShowResultsModal(false);
    return;
  }

if (zkVal) {
  zoomToZK(zkVal.trim());
}

  const matches = featuresRef.current.filter((f) => {
      const zkName = normalizeText(f.normalized?.Zk_Emer);
      const owner = normalizeText((f.owners || []).join(" "));
      const zk = normalizeText(f.zk);

        return (
        (zkVal && (zk.includes(zkVal) || zkName.includes(zkVal))) ||
        (ownerVal && owner.includes(ownerVal)) ||
        (fshatiVal && zkName.includes(fshatiVal))
      );
  });

 const zkFromFshati = findZkByFshati(fshatiVal);

const payload = {
  zk: zkVal || zkFromFshati || null,
  owner: ownerVal || null,
  fshati: fshatiVal || null,
  resultCount: zkVal || zkFromFshati || null
};

// TRACK SEARCH (statistika)
trackSearch(payload);

console.log("TRACK SEARCH CALLED:", payload);

  if (!matches.length) {
    setMessage("Nuk u gjet asnjë rezultat.");
    setResults([]);
    setShowResultsModal(false);
    return;
  }

setMessage("");

// Shfaq tabelën vetëm kur është kërkuar pronari
const shouldShowTable = ownerVal.length > 0;

if (shouldShowTable) {
  setResults(matches.map((f) => f.normalized));
  setShowResultsModal(true);
} else {
  setResults([]);
  setShowResultsModal(false);
}

const group = L.featureGroup(
  matches
    .map((f) => f._layer)
    .filter(Boolean)
);



  if (group.getLayers().length) {
    mapRef.current.fitBounds(group.getBounds(), {
      padding: [30, 30],
      maxZoom: 18,
    });
  }

  matches.forEach((f) => {
    if (f._layer) {
      f._layer.setStyle({
        color: "red",
        weight: 3,
        fillOpacity: 0.5,
      });
    }
  });
};

useEffect(() => {
  const zkFromUrl = window.location.pathname.split("/").pop();
  

  if (zkFromUrl) {
    setTimeout(() => {
      zoomToZK(zkFromUrl);
    }, 1200);
  }
}, []);





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
            <h2> Platforma e Afishimit Publik për Regjistrimin Fillestar</h2>

            <p>
              Afishimi Publik kryhet sipas ligjit 111/2018 “Për Kadastrën”, kjo
              fazë zgjat për 45 ditë nga momenti i afishimit. Njëkohësisht
              afishimet publikohen edhe pranë ambienteve të Njësive
              Administrative përkatëse.
            </p>

            <p style={{ fontSize: "13px" }}>
              Për çdo nevojë për saktësim të të dhënave të afishuara, të
              interesuarit mund të paraqesin kërkesë me shkrim pranë zyrave ku
              është kryer afishimi publik.
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
                  Ju lutem vendosni Zonën Kadastrale
                </div>
              )}

              <input
                  placeholder="Fshati (Emri i Zonës Kadastrale)"
                  value={fshati}
                  onChange={(e) => setFshati(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    marginBottom: "4px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                  }}
                />

                   {!fshati&&(
                <div
                  style={{
                    color: "red",
                    fontSize: "13px",
                    marginBottom: "12px",
                  }}
                >
                  Ju lutem vendosni Zonën Kadastrale
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
                marginTop: "10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                background: "#f0f6ff",
                color: "#004aad",
                border: "1px solid #cfe0ff",
                borderRadius: "8px",
                padding: "8px 10px",
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
