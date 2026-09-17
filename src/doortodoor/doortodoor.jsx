import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./doortodoor.css";

/* =========================================================
   KONFIGURIMI
========================================================= */

const BASE_URL = import.meta.env.BASE_URL || "/";

const NO_ACCESS_STATUS = "Banesë pa akses (PIN LOCATION)";

const GEOJSON_FILES = [
  {
    file: "palas_gjilek.geojson",
    name: "Palasë – Gjilek",
    type: "parcel",
  },
  {
    file: "palas_gjilek_nd.geojson",
    name: "Palasë – Gjilek ND",
    type: "building",
  },
  {
    file: "palas_gjilek_shtes.geojson",
    name: "Palasë – Gjilek shtesë",
    type: "parcel",
  },
  {
    file: "palas_gjilek_nd_shtes.geojson",
    name: "Palasë – Gjilek ND shtesë",
    type: "building",
  },
];

const PALASE = {
  name: "Palasë",
  dv: "Vlorë",
  bashkia: "Himarë",
  periudha: "09.09.2026 - 17.09.2026",
};

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

  container.style.minWidth = "230px";
  container.style.maxWidth = "350px";

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
    row.style.gap = "12px";
    row.style.padding = "5px 0";
    row.style.borderBottom = "1px solid #e5e7eb";

    const labelElement = document.createElement("span");

    labelElement.textContent = label;
    labelElement.style.color = "#64748b";
    labelElement.style.fontSize = "12px";
    labelElement.style.flexShrink = "0";

    const valueElement = document.createElement("b");

    valueElement.textContent = String(value ?? "—");

    valueElement.style.fontSize = "12px";
    valueElement.style.color = "#0f172a";
    valueElement.style.textAlign = "right";
    valueElement.style.overflowWrap = "anywhere";

    row.append(labelElement, valueElement);

    container.appendChild(row);
  };

  addRow("Statusi", status);

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

/* =========================================================
   KOMPONENTI KRYESOR
========================================================= */

export default function DoorToDoor() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Referencat e poligoneve për klikimin nga dashboard-i.
  const featureLayersRef = useRef({});

  const [search, setSearch] = useState("");

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);

  /* =======================================================
     STATISTIKAT
  ======================================================= */

  const noAccessRecords = useMemo(() => {
    return records.filter(
      (item) =>
        item.type === "building" &&
        item.status === NO_ACCESS_STATUS
    );
  }, [records]);

  const statistics = useMemo(() => {
    return {
      total: records.length,

      parcels: records.filter(
        (item) => item.type === "parcel"
      ).length,

      buildings: records.filter(
        (item) => item.type === "building"
      ).length,

      paAkses: noAccessRecords.length,
    };
  }, [records, noAccessRecords]);

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

    const allBounds = L.latLngBounds([]);

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
              const properties =
                feature.properties || {};

              const center = getFeatureCenter(
                feature,
                polygonLayer
              );

              if (!center) {
                console.warn(
                  "Objekt pa qendër të vlefshme:",
                  feature
                );

                return;
              }

              generatedId += 1;

              const id =
                `${source.file}-${generatedId}`;

              const nrAplikimi =
                getProperty(properties, [
                  "nrAplikimi",
                  "NR_APLIKIMI",
                  "NR_UNIK",
                  "OBJECTID",
                  "ID",
                ]) ||
                `PAL-${String(generatedId).padStart(
                  3,
                  "0"
                )}`;

              const nrPasurie =
                getProperty(properties, [
                  "Nr_Pas",
                  "NR_PAS",
                  "NR_PASURIE",
                  "NrPas",
                  "nr_pasurie",
                  "pasuria",
                ]) || "";

              const status = getStatus(properties);

              const isNoAccess =
                isBuilding &&
                status === NO_ACCESS_STATUS;

              const record = {
                id,

                nrAplikimi: String(nrAplikimi),

                nrPasurie: String(nrPasurie),

                NID:
                  getProperty(properties, [
                    "NID",
                    "NR_PERSONAL",
                  ]) || "",

                emer:
                  getProperty(properties, [
                    "EMER",
                    "emer",
                  ]) || "",

                mbiemer:
                  getProperty(properties, [
                    "MBIEMER",
                    "mbiemer",
                  ]) || "",

                status,

                source: source.name,

                type: source.type,

                lat: center.lat,

                lng: center.lng,

                properties,
              };

              allRecords.push(record);

              featureLayersRef.current[id] =
                polygonLayer;

              /* =============================================
                 POPUP: PARCELË OSE NDËRTESË
              ============================================= */

              const popupTitle = isBuilding
                ? `Ndërtesa – ${nrAplikimi}`
                : `Parcela – ${
                    nrPasurie || nrAplikimi
                  }`;

              polygonLayer.bindPopup(
                createPopup(
                  properties,
                  popupTitle,
                  status
                ),
                {
                  maxWidth: 380,
                  autoPan: true,
                  closeButton: true,
                }
              );

              /* =============================================
                 THEKSIMI ME MAUS
              ============================================= */

              const originalStyle =
                getFeatureStyle(
                  isBuilding,
                  properties
                );

              polygonLayer.on("mouseover", () => {
                if (
                  typeof polygonLayer.setStyle !==
                  "function"
                ) {
                  return;
                }

                polygonLayer.setStyle({
                  ...originalStyle,

                  weight:
                    originalStyle.weight + 1,

                  fillOpacity: Math.min(
                    originalStyle.fillOpacity + 0.12,
                    0.48
                  ),
                });
              });

              polygonLayer.on("mouseout", () => {
                if (
                  typeof polygonLayer.setStyle !==
                  "function"
                ) {
                  return;
                }

                polygonLayer.setStyle({
                  ...originalStyle,
                });
              });

              /* =============================================
                 KLIKIMI MBI PARCELËN / NDËRTESËN
              ============================================= */

              polygonLayer.on("click", (event) => {
                setSelectedRecord(record);

                // Leaflet e hap vetë popup-in nga bindPopup.
                // Nuk thërrasim openPopup dy herë.

                if (
                  typeof polygonLayer.setStyle ===
                  "function"
                ) {
                  polygonLayer.setStyle({
                    ...originalStyle,

                    weight: 3.5,

                    fillOpacity: Math.min(
                      originalStyle.fillOpacity + 0.1,
                      0.45
                    ),
                  });
                }
              });

              /* =============================================
                 NUK KRIJOJMË MARKERA
                 SHFAQEN VETËM GJEOMETRITË GEOJSON
              ============================================= */

              if (isNoAccess) {
                console.debug(
                  "Banesë pa akses:",
                  nrAplikimi
                );
              }
            },
          });

          /* =================================================
             RUAJMË SHTRESAT, POR I SHTOJMË NË RADHË
             PASI TË NGARKOHEN TË GJITHA
          ================================================= */

          if (isBuilding) {
            buildingLayers.push({
              layer: geojsonLayer,
              name: source.name,
            });
          } else {
            parcelLayers.push({
              layer: geojsonLayer,
              name: source.name,
            });
          }

          const bounds = geojsonLayer.getBounds();

          if (bounds.isValid()) {
            allBounds.extend(bounds);
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

      parcelLayers.forEach(({ layer, name }) => {
        layer.addTo(map);

        layerControl.addOverlay(layer, name);
      });

      /* =====================================================
         NDËRTESAT SIPËR PARCELAVE
      ===================================================== */

      buildingLayers.forEach(({ layer, name }) => {
        layer.addTo(map);

        layerControl.addOverlay(layer, name);
      });

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

      if (allBounds.isValid()) {
        map.fitBounds(allBounds, {
          padding: [45, 45],
          maxZoom: 16,
          animate: false,
        });
      }

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

  /* =======================================================
     HAP OBJEKTIN NGA DASHBOARD-I
  ======================================================= */

  const openApplicationOnMap = (item) => {
    const map = mapRef.current;

    if (!map) return;

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
          src={`${BASE_URL}images/logo1.jpg`}
          alt="Agjencia Shtetërore e Kadastrës"
          className="doortodoor-logo-img"
          style={{
            width: "150px",
            height: "auto",
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

          {/* ZONA */}

          <section className="area-header">

            <div>

              <span className="area-label">
                Zona aktive
              </span>

              <h2>
                {PALASE.name}
              </h2>

              <div className="area-location">

                <span>
                  {PALASE.dv}
                </span>

                <span>•</span>

                <span>
                  {PALASE.bashkia}
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
                {PALASE.periudha}
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