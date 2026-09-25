import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./doortodoor.css";

/* =========================================================
   KONFIGURIMI
========================================================= */

const BASE_URL = import.meta.env.BASE_URL || "/";

const NO_ACCESS_STATUS = "Banesë pa akses (PIN LOCATION)";

const ZONES = {
  palase: {
    name: "Palasë",
    dv: "Vlorë",
    bashkia: "Himarë",
    periudha: "09.09.2026 - 17.09.2026",
  },
  dhermi: {
    name: "Dhërmi",
    dv: "Vlorë",
    bashkia: "Himarë",
    periudha: "—", // Plotësoje kur të konfirmohet periudha.
  },
};

const GEOJSON_FILES = [
 // { file: "palas_gjilek.geojson", name: "Palasë – Gjilek", zone: "palase", type: "parcel" },
  //{ file: "palas_gjilek_nd.geojson", name: "Palasë – Gjilek ND", zone: "palase", type: "building" },
 // { file: "palas_gjilek_shtes.geojson", name: "Palasë – Gjilek shtesë", zone: "palase", type: "parcel" },
 // { file: "palas_gjilek_nd_shtes.geojson", name: "Palasë – Gjilek ND shtesë", zone: "palase", type: "building" },
  { file: "PARCELA1.geojson", name: "Dhërmi – Parcelat", zone: "dhermi", type: "parcel" },
  { file: "NDERTES1.geojson", name: "Dhërmi – Ndërtesat", zone: "dhermi", type: "building" },
  { file: "Palase_Parcela.geojson", name: "Palasë – Parcelat", zone: "palase", type: "parcel" },
  { file: "Palase_Ndertesat.geojson", name: "Palasë – Ndërtesat", zone: "palase", type: "building" },
];

const ALBANIA_BOUNDS = L.latLngBounds(
  [39.55, 19.05],
  [42.75, 21.15]
);

const COLORS = {
  parcel: {
    color: "#ea580c",
    fillColor: "#f97316",
    weight: 1.8,
    opacity: 1,
    fillOpacity: 0.2,
  },

  building: {
    color: "#15803d",
    fillColor: "#22c55e",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.3,
  },

  noAccess: {
    color: "#b91c1c",
    fillColor: "#ef4444",
    weight: 2.5,
    opacity: 1,
    fillOpacity: 0.35,
  },
};

/* =========================================================
   FUNKSIONE NDIHMËSE
========================================================= */

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getProperty(properties, keys) {
  const entries = Object.entries(properties || {});

  for (const key of keys) {
    const match = entries.find(
      ([propertyName]) =>
        normalize(propertyName) === normalize(key)
    );

    if (
      match &&
      match[1] !== null &&
      match[1] !== undefined &&
      match[1] !== ""
    ) {
      return match[1];
    }
  }

  return null;
}

function getStatus(properties) {
  const rawStatus = getProperty(properties, [
    "status",
    "statusi",
    "gjendja",
    "tipologjia",
    "category",
    "kategori",
  ]);

  const status = normalize(rawStatus);

  if (
    status.includes("pa akses") ||
    status.includes("pa_akses") ||
    status.includes("no access") ||
    status.includes("pin location")
  ) {
    return NO_ACCESS_STATUS;
  }

  return rawStatus
    ? String(rawStatus)
    : "Status i papërcaktuar";
}

function getFeatureStyle(isBuilding, properties) {
  if (!isBuilding) {
    return { ...COLORS.parcel };
  }

  if (getStatus(properties) === NO_ACCESS_STATUS) {
    return { ...COLORS.noAccess };
  }

  return { ...COLORS.building };
}

function isValidGeometry(feature) {
  const geometry = feature?.geometry;

  if (!geometry) return false;

  return (
    [
      "Polygon",
      "MultiPolygon",
      "Point",
      "MultiPoint",
    ].includes(geometry.type) &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0
  );
}

function getFeatureCenter(feature, layer) {
  try {
    if (feature?.geometry?.type === "Point") {
      const [lng, lat] = feature.geometry.coordinates;

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        return L.latLng(lat, lng);
      }
    }

    if (typeof layer.getBounds === "function") {
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        return bounds.getCenter();
      }
    }

    if (typeof layer.getLatLng === "function") {
      return layer.getLatLng();
    }
  } catch (error) {
    console.warn(
      "Nuk u përcaktua qendra e objektit:",
      error
    );
  }

  return null;
}

function getFeatures(data) {
  if (!data) return [];

  if (data.type === "FeatureCollection") {
    return Array.isArray(data.features)
      ? data.features
      : [];
  }

  if (data.type === "Feature") {
    return [data];
  }

  if (
    data.type === "GeometryCollection" &&
    Array.isArray(data.geometries)
  ) {
    return data.geometries.map((geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    }));
  }

  if (data.type && data.coordinates) {
    return [
      {
        type: "Feature",
        properties: {},
        geometry: data,
      },
    ];
  }

  return [];
}

function createPopup(properties, title, status) {
  const container = document.createElement("div");

  container.className = "doortodoor-popup";
  container.style.minWidth = "280px";
  container.style.maxWidth = "420px";
  container.style.maxHeight = "450px";
  container.style.overflowY = "auto";

  const heading = document.createElement("strong");

  heading.textContent = title;
  heading.style.display = "block";
  heading.style.fontSize = "15px";
  heading.style.marginBottom = "10px";
  heading.style.color = "#172554";

  container.appendChild(heading);

  const addRow = (label, value) => {
    const row = document.createElement("div");

    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "flex-start";
    row.style.gap = "15px";
    row.style.padding = "6px 0";
    row.style.borderBottom = "1px solid #e5e7eb";

    const labelElement = document.createElement("span");

    labelElement.textContent = label;
    labelElement.style.color = "#64748b";
    labelElement.style.fontSize = "12px";
    labelElement.style.fontWeight = "500";
    labelElement.style.flexShrink = "0";

    const valueElement = document.createElement("strong");

    valueElement.textContent =
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
        ? String(value)
        : "—";

    valueElement.style.fontSize = "12px";
    valueElement.style.color = "#0f172a";
    valueElement.style.textAlign = "right";
    valueElement.style.overflowWrap = "anywhere";

    row.append(labelElement, valueElement);
    container.appendChild(row);
  };

  // Statusi
  addRow("Statusi", status);

  // TË GJITHA properties nga GeoJSON
  const entries = Object.entries(properties || {});

  if (entries.length === 0) {
    addRow(
      "Informacion",
      "Ky objekt nuk ka atribute në GeoJSON."
    );
  }

  entries.forEach(([key, value]) => {
    if (
      value === null ||
      value === undefined ||
      typeof value === "object"
    ) {
      return;
    }

    addRow(key, value);
  });

  return container;
}


function createPolygonLabel(properties) {
  const status = getStatus(properties);

  const adresa = getProperty(properties, [
    "adresa",
    "ADRESA",
  ]) || "—";

const nrPasurie = isBuilding
  ? getProperty(properties, [
      "NR_PASURIE",
      "nr_pasurie",
      "nr_pas",
      "Nr_Pas",
      "NR_PAS",
      "NrPas",
    ]) ?? ""
  : getProperty(properties, [
      "nr_pas",
      "NR_PASURIE",
      "nr_pasurie",
      "Nr_Pas",
      "NR_PAS",
      "NrPas",
    ]) ?? "";

  const zonaKadastrale = getProperty(properties, [
    "zona_kadas",
    "zona_kadastrale",
    "ZK",
    "NR_ZK",
  ]) || "—";

  const siperfaqja = getProperty(properties, [
    "sip_parcel",
    "sip_nderti",
    "Shape_Area",
    "sip2",
  ]) || "—";

  const container = document.createElement("div");

  container.style.minWidth = "210px";

  const fields = [
    ["Statusi", status],
    ["Adresa", adresa],
    ["Nr. pasurie", nrPasurie],
    ["Zona kadastrale", zonaKadastrale],
    ["Sipërfaqja", siperfaqja],
  ];

  fields.forEach(([label, value]) => {
    const row = document.createElement("div");

    row.style.padding = "4px 0";
    row.style.fontSize = "12px";
    row.style.borderBottom = "1px solid #e5e7eb";

    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;

    const span = document.createElement("span");
    span.textContent = String(value);

    row.append(strong, span);
    container.appendChild(row);
  });

  return container;
}
/* =========================================================
   KOMPONENTI KRYESOR
========================================================= */

export default function DoorToDoor() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Referencat e poligoneve për klikimin nga dashboard-i.
  const featureLayersRef = useRef({});
  const zoneLayersRef = useRef({ palase: [], dhermi: [] });
  const zoneBoundsRef = useRef({});
  const [selectedZone, setSelectedZone] = useState("palase");
  const activeZone = ZONES[selectedZone];

  const [search, setSearch] = useState("");

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [clickMode, setClickMode] = useState("parcel");

    const clickModeRef = useRef("parcel");

   const changeClickMode = (mode) => {
  clickModeRef.current = mode;
  setClickMode(mode);

  const map = mapRef.current;

  if (!map) return;

  const showLabels = map.getZoom() > 12;

  Object.values(featureLayersRef.current).forEach((layer) => {
    const tooltip = layer.getTooltip?.();

    if (!tooltip || !map.hasLayer(layer)) return;

    if (showLabels && layer._doorToDoorType === mode) {
      layer.openTooltip();
    } else {
      layer.closeTooltip();
    }
  });
};

  /* =======================================================
     STATISTIKAT
  ======================================================= */

  const noAccessRecords = useMemo(() => {
    return records.filter(
      (item) =>
        item.zone === selectedZone &&
        item.type === "building" &&
        item.status === NO_ACCESS_STATUS
    );
  }, [records, selectedZone]);

  const zoneRecords = useMemo(
    () => records.filter((item) => item.zone === selectedZone),
    [records, selectedZone]
  );

  const statistics = useMemo(() => {
    return {
      total: zoneRecords.length,

      parcels: zoneRecords.filter(
        (item) => item.type === "parcel"
      ).length,

      buildings: zoneRecords.filter(
        (item) => item.type === "building"
      ).length,

      paAkses: noAccessRecords.length,
    };
  }, [zoneRecords, noAccessRecords]);

  const filteredRecords = useMemo(() => {
    const query = normalize(search);

    if (!query) {
      return noAccessRecords;
    }

    return noAccessRecords.filter((item) => {
      const searchableText = [
        item.nrAplikimi,
        item.nrPasurie,
        item.NID,
        item.emer,
        item.mbiemer,
        item.source,
        item.status,
      ].join(" ");

      return normalize(searchableText).includes(query);
    });
  }, [noAccessRecords, search]);

  /* =======================================================
     INICIALIZIMI I HARTËS
  ======================================================= */

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) return;

    let disposed = false;

    const controller = new AbortController();

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,

      preferCanvas: true,

      zoomAnimation: true,

      fadeAnimation: true,

      scrollWheelZoom: true,

      minZoom: 7,

      maxZoom: 20,

      maxBounds: ALBANIA_BOUNDS,

      maxBoundsViscosity: 1,
    });

    // Numrat shfaqen vetëm kur zoom-i është mbi 12.
    // Kontrolli kryhet edhe pasi ngarkohen GeoJSON-et asinkronisht.
      const updatePropertyLabels = () => {
        if (disposed || mapRef.current !== map) return;

        const currentMode = clickModeRef.current;
        const showLabels = map.getZoom() > 12;

        Object.values(featureLayersRef.current).forEach((layer) => {
          if (!layer.getTooltip?.() || !map.hasLayer(layer)) return;

          const layerType = layer._doorToDoorType;

          if (showLabels && layerType === currentMode) {
            layer.openTooltip();
          } else {
            layer.closeTooltip();
          }
        });
      };

map.on("zoomend", updatePropertyLabels);
    map.on("zoomend", updatePropertyLabels);

    mapRef.current = map;

    map.fitBounds(ALBANIA_BOUNDS, {
      padding: [25, 25],
      animate: false,
    });

    /* =====================================================
       SHTRESAT E HARTËS
    ===================================================== */

    map.createPane("albaniaBorder");

    map.getPane("albaniaBorder").style.zIndex = 410;

    map.getPane("albaniaBorder").style.pointerEvents =
      "none";

    map.createPane("parcelPane");

    map.getPane("parcelPane").style.zIndex = 420;

    map.createPane("buildingPane");

    map.getPane("buildingPane").style.zIndex = 430;

       const updateClickMode = (mode) => {
            map.getPane("parcelPane").style.pointerEvents =
              mode === "parcel" ? "auto" : "none";

            map.getPane("buildingPane").style.pointerEvents =
              mode === "building" ? "auto" : "none";
          };

    /* =====================================================
       HARTA SATELITORE
    ===================================================== */

    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxNativeZoom: 18,
        maxZoom: 20,
        keepBuffer: 4,
        attribution: "Tiles © Esri",
      }
    );

    const osmLayer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxNativeZoom: 19,
        maxZoom: 20,
        attribution: "© OpenStreetMap contributors",
      }
    );

    satelliteLayer.addTo(map);

    /* =====================================================
       KONTROLLET
    ===================================================== */

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map);

    L.control
      .scale({
        position: "bottomleft",
        imperial: false,
      })
      .addTo(map);

    const layerControl = L.control.layers(
      {
        Satelit: satelliteLayer,
        OpenStreetMap: osmLayer,
      },
      {},
      {
        collapsed: true,
        position: "topright",
      }
    );

    layerControl.addTo(map);

    /* =====================================================
       KOLEKSIONET
    ===================================================== */

    const allRecords = [];

    const boundsByZone = {};

    const parcelLayers = [];

    const buildingLayers = [];

    let generatedId = 0;

    /* =====================================================
       NGARKIMI I GEOJSON
    ===================================================== */

    async function loadGeoJSON() {
      setLoading(true);
      setError("");

      const failedFiles = [];

      for (const source of GEOJSON_FILES) {
        if (disposed) return;

        try {
          const url =
            `${BASE_URL}geojson/newjson/${source.file}`;

          const response = await fetch(url, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status} – ${url}`
            );
          }

          let data;

          try {
            const text = await response.text();

            data = JSON.parse(text);
          } catch (parseError) {
            throw new Error(
              `JSON i pavlefshëm: ${parseError.message}`
            );
          }

          if (disposed || mapRef.current !== map) {
            return;
          }

          const features = getFeatures(data).filter(
            isValidGeometry
          );

          const isBuilding =
            source.type === "building";

          console.log(
            `${source.file}: ${features.length} objekte`
          );

          /* =================================================
             KRIJIMI I SHTRESËS
          ================================================= */

          const geojsonLayer = L.geoJSON(features, {
            pane: isBuilding
              ? "buildingPane"
              : "parcelPane",

            interactive: true,

            bubblingMouseEvents: false,

            pointToLayer: (feature, latlng) => {
              const style = getFeatureStyle(
                isBuilding,
                feature.properties || {}
              );

              return L.circleMarker(latlng, {
                ...style,
                radius: 6,

                pane: isBuilding
                  ? "buildingPane"
                  : "parcelPane",
              });
            },

         

            /* ===============================================
               NGJYRAT DHE TRANSPARENCA
            =============================================== */

            style: (feature) => {
              return getFeatureStyle(
                isBuilding,
                feature.properties || {}
              );
            },



            /* ===============================================
               INFORMACIONI PËR ÇDO OBJEKT
            =============================================== */

              onEachFeature: (feature, polygonLayer) => {
                const properties = feature.properties || {};

                const center = getFeatureCenter(feature, polygonLayer);

                if (!center) {
                  console.warn(
                    "Objekt pa qendër të vlefshme:",
                    feature
                  );
                  return;
                }

                generatedId += 1;

                const id = `${source.file}-${generatedId}`;

                /* =====================================================
                  TË DHËNAT NGA GEOJSON
                ===================================================== */

                const nrAplikimi =
                  getProperty(properties, [
                    "nrAplikimi",
                    "NR_APLIKIMI",
                    "NR_UNIK",
                    "OBJECTID",
                    "ID",
                  ]) || `PAL-${String(generatedId).padStart(3, "0")}`;

                // E njëjta logjikë për parcelat DHE ndërtesat.
                const nrPasurie =
                  getProperty(properties, [
                    "nr_pasuris",
                    "nr_pasurie",
                    "NR_PASURIE",
                    "Nr_Pas",
                    "NR_PAS",
                    "NrPas",
                    "pasuria",
                  ]) ?? "";

                const adresa =
                  getProperty(properties, [
                    "adresa",
                    "ADRESA",
                  ]) ?? "—";

                const zonaKadastrale =
                  getProperty(properties, [
                    "zona_kadas",
                    "zona_kadastrale",
                    "ZK",
                    "NR_ZK",
                  ]) ?? "—";

                const siperfaqja = isBuilding
                  ? getProperty(properties, [
                      "sip_nderti",
                      "sip_banim",
                      "Shape_Area",
                      "sip2",
                    ])
                  : getProperty(properties, [
                      "sip_parcel",
                      "Shape_Area",
                      "sip2",
                    ]);

                const status = getStatus(properties);

                /* =====================================================
                  REGJISTRIMI PËR DASHBOARD
                ===================================================== */

                const record = {
                  id,
                  zone: source.zone,

                  nrAplikimi: String(nrAplikimi),

                  nrPasurie: String(nrPasurie),

                  NID:
                    getProperty(properties, [
                      "NID",
                      "NR_PERSONAL",
                    ]) ?? "",

                  emer:
                    getProperty(properties, [
                      "EMER",
                      "emer",
                    ]) ?? "",

                  mbiemer:
                    getProperty(properties, [
                      "MBIEMER",
                      "mbiemer",
                    ]) ?? "",

                  status,

                  source: source.name,

                  type: source.type,

                  lat: center.lat,

                  lng: center.lng,

                  properties,
                };

                allRecords.push(record);

                featureLayersRef.current[id] = polygonLayer;

                /* =====================================================
                  TOOLTIP: NR. I PASURISË PËR TË DY SHTRESAT
                  SHFAQET VETËM NË ZOOM > 12
                ===================================================== */

                polygonLayer._doorToDoorType = isBuilding
                    ? "building"
                    : "parcel";

             const hasNrPasurie =
              nrPasurie !== null &&
              nrPasurie !== undefined &&
              String(nrPasurie).trim() !== "";

            if (hasNrPasurie) {
              polygonLayer.bindTooltip(String(nrPasurie), {
                permanent: true,
                sticky: false,
                direction: "center",
                opacity: 1,
                interactive: false,
                className: "parcel-number-label",
              });
            }

                /* =====================================================
                  POPUP
                  VETËM 5 FUSHAT, PAS KLIKIMIT
                ===================================================== */

               const popupContainer = document.createElement("div");

popupContainer.className = "doortodoor-popup";
popupContainer.style.minWidth = "280px";
popupContainer.style.maxWidth = "400px";

const popupTitle = document.createElement("strong");

popupTitle.textContent = isBuilding
  ? "Informacion mbi ndërtesën"
  : "Informacion mbi parcelën";

popupTitle.style.display = "block";
popupTitle.style.marginBottom = "10px";
popupTitle.style.fontSize = "14px";
popupTitle.style.color = "#0f172a";

popupContainer.appendChild(popupTitle);


/* =========================================
   TË GJITHA FUSHAT
========================================= */

const popupFields = [
  ["Tipi", isBuilding ? "Ndërtesë" : "Parcelë"],

  [
    isBuilding
      ? "Nr. pasurie ndërtesë"
      : "Nr. pasurie parcelë",
    nrPasurie || "—",
  ],

  [
    "Sipërfaqja",
    getProperty(properties, ["SIP", "sip"]) ?? "—",
  ],

  [
    "Bashkia",
    getProperty(properties, ["BASHKIA", "bashkia"]) ?? "—",
  ],

  [
    "Zona kadastrale",
    getProperty(properties, ["ZK", "zk"]) ?? "—",
  ],

  [
    "Adresa",
    getProperty(properties, ["ADRESA", "adresa"]) ?? "—",
  ],

  [
    "Poseduesi",
    getProperty(properties, ["POSEDUESI", "poseduesi"]) ?? "—",
  ],

  [
    "Nr. unik",
    getProperty(properties, ["NR_UNIK", "nr_unik"]) ?? "—",
  ],

  [
    "Zona",
    getProperty(properties, ["ZONA", "zona"]) ?? "—",
  ],
];


/* =========================================
   KRIJO RRESHTAT
========================================= */

popupFields.forEach(([label, value]) => {
  const row = document.createElement("div");

  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.alignItems = "flex-start";
  row.style.gap = "12px";
  row.style.padding = "6px 0";
  row.style.borderBottom = "1px solid #e5e7eb";
  row.style.fontSize = "12px";

  const labelElement = document.createElement("span");

  labelElement.textContent = label;
  labelElement.style.color = "#64748b";
  labelElement.style.flexShrink = "0";

  const valueElement = document.createElement("strong");

  valueElement.textContent = String(value);
  valueElement.style.color = "#0f172a";
  valueElement.style.textAlign = "right";
  valueElement.style.overflowWrap = "anywhere";

  row.append(labelElement, valueElement);
  popupContainer.appendChild(row);
});


/* =========================================
   POPUP
========================================= */

polygonLayer.bindPopup(popupContainer, {
  maxWidth: 400,
  autoPan: true,
  closeButton: true,
});

              
               

                /* =====================================================
                  STILI ORIGJINAL
                ===================================================== */

                const originalStyle = getFeatureStyle(
                  isBuilding,
                  properties
                );

                /* =====================================================
                  MOUSEOVER
                ===================================================== */

                polygonLayer.on("mouseover", () => {
                  if (typeof polygonLayer.setStyle !== "function") {
                    return;
                  }

                  polygonLayer.setStyle({
                    ...originalStyle,

                    weight: originalStyle.weight + 1,

                    fillOpacity: Math.min(
                      originalStyle.fillOpacity + 0.12,
                      0.48
                    ),
                  });
                });

                /* =====================================================
                  MOUSEOUT
                ===================================================== */

                polygonLayer.on("mouseout", () => {
                  if (typeof polygonLayer.setStyle !== "function") {
                    return;
                  }

                  polygonLayer.setStyle({
                    ...originalStyle,
                  });
                });

                /* =====================================================
                  KLIKIMI
                  HAP INFORMACIONIN E PARCELËS OSE NDËRTESËS
                ===================================================== */

                polygonLayer.on("click", (event) => {
                  setSelectedRecord(record);

                  // Popup-i hapet vetëm pas klikimit.
                  polygonLayer.openPopup(event.latlng);
                });
              },      });

          /* =================================================
             RUAJMË SHTRESAT, POR I SHTOJMË NË RADHË
             PASI TË NGARKOHEN TË GJITHA
          ================================================= */

          const layerEntry = {
            layer: geojsonLayer,
            name: source.name,
            zone: source.zone,
          };

          zoneLayersRef.current[source.zone].push(layerEntry);

          if (isBuilding) {
            buildingLayers.push(layerEntry);
          } else {
            parcelLayers.push(layerEntry);
          }

          const bounds = geojsonLayer.getBounds();

          if (bounds.isValid()) {
            if (!boundsByZone[source.zone]) {
              boundsByZone[source.zone] = L.latLngBounds([]);
            }
            boundsByZone[source.zone].extend(bounds);
          }
        } catch (loadError) {
          if (loadError.name === "AbortError") {
            return;
          }

          console.error(
            `Gabim te ${source.file}:`,
            loadError
          );

          failedFiles.push(
            `${source.file}: ${loadError.message}`
          );
        }
      }

      if (disposed || mapRef.current !== map) {
        return;
      }

      /* =====================================================
         PARCELAT POSHTË
      ===================================================== */

      parcelLayers.forEach(({ layer, zone }) => {
        if (zone === "palase") layer.addTo(map);
      });

      /* =====================================================
         NDËRTESAT SIPËR PARCELAVE
      ===================================================== */

      buildingLayers.forEach(({ layer, zone }) => {
        if (zone === "palase") layer.addTo(map);
      });

      zoneBoundsRef.current = boundsByZone;

      // Shtresat tani janë në hartë: zbato pragun e zoom-it.
      updatePropertyLabels();

      /* =====================================================
         DASHBOARD
      ===================================================== */

      setRecords([...allRecords]);

      setLoading(false);

      if (failedFiles.length > 0) {
        setError(
          `Nuk u ngarkuan: ${failedFiles.join(
            " | "
          )}`
        );
      }

      /* =====================================================
         ZOOM TE PALASA NGA GEOJSON
      ===================================================== */

      const initialBounds = boundsByZone.palase;
      if (initialBounds?.isValid()) {
        map.fitBounds(initialBounds, {
          padding: [45, 45],
          maxZoom: 16,
          animate: false,
        });
      }

      // Sigurohu që etiketat përputhen me zoom-in përfundimtar.
      updatePropertyLabels();

      console.log("GEOJSON:", {
        total: allRecords.length,

        parcela: allRecords.filter(
          (item) => item.type === "parcel"
        ).length,

        ndertesa: allRecords.filter(
          (item) => item.type === "building"
        ).length,

        paAkses: allRecords.filter(
          (item) =>
            item.type === "building" &&
            item.status === NO_ACCESS_STATUS
        ).length,
      });

      map.invalidateSize();
    }

    /* =====================================================
       KUFIJTË E SHQIPËRISË
    ===================================================== */

    async function loadAlbania() {
      try {
        const response = await fetch(
          `${BASE_URL}geojson/newjson/gadm41_ALB_0.geojson`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (disposed || mapRef.current !== map) {
          return;
        }

        L.geoJSON(data, {
          pane: "albaniaBorder",

          interactive: false,

          style: {
            color: "#cbd5e1",
            weight: 1.5,
            opacity: 0.65,
            fillOpacity: 0,
          },
        }).addTo(map);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          console.warn(
            "Kufiri i Shqipërisë:",
            loadError
          );
        }
      }
    }

    /* =====================================================
       BUTONI SHQIPËRIA
    ===================================================== */

    const AlbaniaControl = L.Control.extend({
      options: {
        position: "topright",
      },

      onAdd: () => {
        const div = L.DomUtil.create(
          "div",
          "albania-control"
        );

        const button = L.DomUtil.create(
          "button",
          "albania-control-button",
          div
        );

        button.type = "button";

        button.textContent = "← Shqipëria";

        L.DomEvent.disableClickPropagation(div);

        L.DomEvent.disableScrollPropagation(div);

        L.DomEvent.on(button, "click", () => {
          map.fitBounds(ALBANIA_BOUNDS, {
            padding: [30, 30],
            animate: true,
          });
        });

        return div;
      },
    });

    map.addControl(new AlbaniaControl());

    /* =====================================================
       NIS NGARKIMIN
    ===================================================== */

    loadAlbania();

    loadGeoJSON();

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      disposed = true;

      controller.abort();

      featureLayersRef.current = {};
      zoneLayersRef.current = { palase: [], dhermi: [] };
      zoneBoundsRef.current = {};

      map.off("zoomend", updatePropertyLabels);
      map.off();

      try {
        map.stop();

        map.remove();
      } catch (cleanupError) {
        console.warn(
          "Gabim gjatë mbylljes së hartës:",
          cleanupError
        );
      }

      mapRef.current = null;
    };
  }, []);

  // Ndërrimi i zonës: shtresat dhe kufijtë merren vetëm nga GeoJSON.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    Object.entries(zoneLayersRef.current).forEach(([zone, entries]) => {
      entries.forEach(({ layer }) => {
        if (zone === selectedZone) {
          if (!map.hasLayer(layer)) layer.addTo(map);
        } else if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    });

    const bounds = zoneBoundsRef.current[selectedZone];
    if (bounds?.isValid()) {
      map.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: 16,
        animate: false,
      });
    }

    // Etiketat permanente të shtresave të reja respektojnë zoom-in.
    Object.values(featureLayersRef.current).forEach((layer) => {
      if (!layer.getTooltip?.() || !map.hasLayer(layer)) return;
      if (map.getZoom() > 12) layer.openTooltip();
      else layer.closeTooltip();
    });
    setSelectedRecord(null);
  }, [selectedZone, loading]);

  /* =======================================================
     HAP OBJEKTIN NGA DASHBOARD-I
  ======================================================= */

  const openApplicationOnMap = (item) => {
    const map = mapRef.current;

    if (!map || item.zone !== selectedZone) return;

    const polygonLayer =
      featureLayersRef.current[item.id];

    setSelectedRecord(item);

    if (!polygonLayer) {
      return;
    }

    // Aktivizo shtresën nëse përdoruesi e ka fshehur.
    const parentLayer =
      polygonLayer._eventParents
        ? Object.values(
            polygonLayer._eventParents
          ).find(
            (parent) =>
              parent instanceof L.GeoJSON
          )
        : null;

    if (parentLayer && !map.hasLayer(parentLayer)) {
      parentLayer.addTo(map);
    }

    map.flyTo(
      [item.lat, item.lng],
      19,
      {
        duration: 0.8,
      }
    );

    map.once("moveend", () => {
      if (mapRef.current === map) {
        polygonLayer.openPopup();
      }
    });
  };

useEffect(() => {
  const map = mapRef.current;

  if (!map) return;

  const parcelPane = map.getPane("parcelPane");
  const buildingPane = map.getPane("buildingPane");

  if (!parcelPane || !buildingPane) return;

  parcelPane.style.pointerEvents =
    clickMode === "parcel" ? "auto" : "none";

  buildingPane.style.pointerEvents =
    clickMode === "building" ? "auto" : "none";
}, [clickMode]);


  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="doortodoor-page">

      {/* HEADER */}

      <header className="doortodoor-header">

        <div className="doortodoor-header-left">

          <div>

            <h1>
              Platforma e Evidentimit në Terren
            </h1>

            <p>
              Derë më Derë
            </p>

          </div>

        </div>

        <img
          src={`${BASE_URL}images/logo_ashk_1.png`}
          alt="Agjencia Shtetërore e Kadastrës"
          className="doortodoor-logo-img"
          style={{
            width: "90px",
            height: "auto",
            marginBottom:"30px",
          }}
        />

      </header>

      {/* MAIN */}

      <div className="doortodoor-main">

        {/* MAP */}

        <section className="doortodoor-map-section">

          <div
            ref={mapContainerRef}
            id="doortodoor-map"
            className="doortodoor-map"
          />

        </section>

        {/* DASHBOARD */}

        <aside className="doortodoor-dashboard">
          {/* ZONAT E VEÇANTA - GATI PËR DASHBOARD-IN E PËRGJITHSHËM */}
       {/* ZGJEDHJA E ZONËS - DROPDOWN */}

        <section className="dashboard-section">
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "16px",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <label
              htmlFor="zone-select"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "#64748b",
                marginBottom: "9px",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              Zgjidh zonën
            </label>

            <div style={{ position: "relative" }}>
              <select
                id="zone-select"
                value={selectedZone}
                onChange={(event) => {
                  setSelectedZone(event.target.value);
                  setSearch("");
                  setSelectedRecord(null);
                }}
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0 42px 0 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  outlineColor: "#0f766e",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                {Object.entries(ZONES).map(([zoneId, zone]) => (
                  <option key={zoneId} value={zoneId}>
                    {zone.name}
                  </option>
                ))}
              </select>

              <span
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#0f766e",
                  fontSize: "13px",
                }}
              >
                ▼
              </span>
            </div>
          </div>
        </section>

          {/* ZONA */}

          <section className="area-header">

            <div>

              <span className="area-label">
                Zona aktive
              </span>

              <h2>
                {activeZone.name}
              </h2>

              <div className="area-location">

                <span>
                  {activeZone.dv}
                </span>

                <span>•</span>

                <span>
                  {activeZone.bashkia}
                </span>

              </div>

            </div>

            <span className="area-status">
              Në proces
            </span>

          </section>

          {/* PERIUDHA */}

          <section className="period-card">

            <div className="period-icon">
              ◷
            </div>

            <div>

              <span>
                Periudha e evidentimit në terren
              </span>

              <strong>
                {activeZone.periudha}
              </strong>

            </div>

          </section>

          {/* STATISTIKAT */}

          <section className="dashboard-kpis">

            <div className="kpi-card">

              <span>
                Objekte te shqyrtuara
              </span>

              <strong>
                {statistics.total}
              </strong>

            </div>

            <div className="kpi-card kpi-red">

              <span>
                Pa akses
              </span>

              <strong>
                {statistics.paAkses}
              </strong>

            </div>

          </section>


          <section className="dashboard-section">
            <div className="dashboard-section-title">
              <h3>Zgjidh objektin në hartë</h3>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => changeClickMode("parcel")}
                style={{
                  flex: 1,
                  padding: "10px",
                  cursor: "pointer",
                  background:
                    clickMode === "parcel" ? "#f97316" : "#fff",
                  color:
                    clickMode === "parcel" ? "#fff" : "#334155",
                  border: "1px solid #f97316",
                  borderRadius: "8px",
                }}
              >
                Parcelat
              </button>

              <button
                type="button"
                onClick={() => changeClickMode("building")}
                style={{
                  flex: 1,
                  padding: "10px",
                  cursor: "pointer",
                  background:
                    clickMode === "building" ? "#16a34a" : "#fff",
                  color:
                    clickMode === "building" ? "#fff" : "#334155",
                  border: "1px solid #16a34a",
                  borderRadius: "8px",
                }}
              >
                Ndërtesat
              </button>
            </div>
          </section>

          {/* LEGJENDA */}

          <section className="dashboard-section">

            <div className="dashboard-section-title">

              <h3>
                Legjenda e hartës
              </h3>

            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "13px",
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >

                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    background: "#f97316",
                    border: "2px solid #ea580c",
                    borderRadius: "3px",
                  }}
                />

                <span>
                  Parcelat ({statistics.parcels})
                </span>

              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >

                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    background: "#22c55e",
                    border: "2px solid #15803d",
                    borderRadius: "3px",
                  }}
                />

                <span>
                  Ndërtesat ({statistics.buildings})
                </span>

              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >

                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    background: "#ef4444",
                    border: "2px solid #b91c1c",
                    borderRadius: "3px",
                  }}
                />

                <span>
                  Banesa pa akses ({statistics.paAkses})
                </span>

              </div>

            </div>

          </section>

          {/* LOADING */}

          {loading && (

            <section className="dashboard-section">

              <p>
                Duke ngarkuar të dhënat GeoJSON...
              </p>

            </section>

          )}

          {/* GABIMET */}

          {error && (

            <section className="dashboard-section">

              <p
                style={{
                  color: "#dc2626",
                  overflowWrap: "anywhere",
                }}
              >
                {error}
              </p>

            </section>

          )}

          {/* KËRKIMI */}

          <section className="dashboard-section">

            <div className="dashboard-section-title">

              <h3>
                Kërko banesë
              </h3>

            </div>

            <div className="dashboard-search">

              <span>⌕</span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="NID / Nr. aplikimi..."
              />

            </div>

          </section>

          {/* BANESAT PA AKSES */}

          <section className="dashboard-section applications-section">

            <div className="dashboard-section-title">

              <h3>
                Banesa pa akses
              </h3>

              <span>
                {filteredRecords.length}
              </span>

            </div>

            <div className="applications-list">

              {filteredRecords.length === 0 ? (

                <div className="empty-applications">

                  <div className="empty-icon">
                    !
                  </div>

                  <strong>
                    Nuk ka banesa pa akses të regjistruara
                  </strong>

                  <p>
                    {loading
                      ? "Duke ngarkuar të dhënat..."
                      : "Nuk u gjetën rezultate për filtrin e zgjedhur."}
                  </p>

                </div>

              ) : (

                filteredRecords.map((item) => (

                  <article
                    className="application-card"
                    key={item.id}
                    onClick={() =>
                      openApplicationOnMap(item)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >

                    <div className="application-main">

                      <strong>
                        {item.nrAplikimi}
                      </strong>

                      <span>
                        {item.status}
                      </span>

                      {item.nrPasurie && (

                        <small>
                          Nr. pasurie: {item.nrPasurie}
                        </small>

                      )}

                    </div>

                  </article>

                ))

              )}

            </div>

          </section>

          {/* OBJEKTI I ZGJEDHUR */}

          {selectedRecord && (

            <section className="dashboard-section">

              <div className="dashboard-section-title">

                <h3>
                  {selectedRecord.type === "parcel"
                    ? "Parcela e zgjedhur"
                    : "Ndërtesa e zgjedhur"}
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRecord(null)
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>

              </div>

              <div className="application-card">

                <strong>
                  {selectedRecord.type === "parcel"
                    ? selectedRecord.nrPasurie ||
                      selectedRecord.nrAplikimi
                    : selectedRecord.nrAplikimi}
                </strong>

                <p>
                  {selectedRecord.status}
                </p>

                <small>
                  {selectedRecord.source}
                </small>

                {/* TË DHËNAT REALE NGA GEOJSON */}

                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                >

                  {Object.entries(
                    selectedRecord.properties || {}
                  ).map(([key, value]) => {

                    if (
                      value === null ||
                      value === undefined ||
                      typeof value === "object"
                    ) {
                      return null;
                    }

                    return (

                      <div
                        key={key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          borderBottom:
                            "1px solid #e5e7eb",
                          paddingBottom: "5px",
                          fontSize: "12px",
                        }}
                      >

                        <span
                          style={{
                            color: "#64748b",
                          }}
                        >
                          {key}
                        </span>

                        <strong
                          style={{
                            color: "#0f172a",
                            textAlign: "right",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {String(value)}
                        </strong>

                      </div>

                    );
                  })}

                </div>

              </div>

            </section>

          )}

        </aside>

      </div>

      {/* FOOTER */}

      <footer className="doortodoor-footer">
        © Agjencia Shtetërore e Kadastrës
      </footer>

    </div>
  );
}