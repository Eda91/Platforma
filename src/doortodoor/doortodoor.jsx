import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./doortodoor.css";

/* =========================================================
   LEAFLET DEFAULT ICONS
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* =========================================================
   ALBANIA
========================================================= */

const ALBANIA_BOUNDS = L.latLngBounds(
  [39.55, 19.05],
  [42.75, 21.15]
);

/* =========================================================
   PALASË
========================================================= */

const PALASE = {
  name: "Palasë",

  position: [
    40.1665,
    19.6241,
  ],

  dv: "Vlorë",
  bashkia: "Himarë",
  njesiaAdministrative: "Palasë",
  fshati: "Palasë",

  periudha:
    "09.09.2026 - 17.09.2026",
};

/* =========================================================
   WORLD MASK
========================================================= */

const WORLD = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];

/* =========================================================
   STATUS
========================================================= */

const STATUS_OPTIONS = [
  "Të gjitha",
  "Banesë pa akses (PIN LOCATION)",
  "Mungesë dokumentacioni (deklaratë noteriale)",
  "Mungesë dokumentacioni (Dëshmi Trashëgimie)",
  "Mungesë dokumentacioni (Kërkesa për përfshirje në proces)",
  "Mungesë dokumentacioni (Dokumentacion provues që objekti është ndërtuar para dt. 10.08.1991)",
];

/* =========================================================
   DEMO RECORD

   lat/lng = koordinata që më dhe ti.
   displayLat/displayLng = pozicioni vizual në hartë.

   Fillimisht janë null.
   Marker-i mund të tërhiqet mbi shtëpinë që dëshiron.
========================================================= */

const INITIAL_RECORDS = [
  {
    id: 1,
    nrAplikimi: "PAL-001",
    emer: "Objekt",
    atesi: "",
    mbiemer: "Shembull 1",
    status:
      "Mungesë dokumentacioni (deklaratë noteriale)",
    lat: 40.16598097555627,
    lng: 19.625158756971363,
  },

 
];

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;

  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


function pointInsideBuilding(lat, lng, geometry) {
  let inside = false;

  for (
    let i = 0, j = geometry.length - 1;
    i < geometry.length;
    j = i++
  ) {
    const xi = geometry[i].lon;
    const yi = geometry[i].lat;

    const xj = geometry[j].lon;
    const yj = geometry[j].lat;

    const intersect =
      yi > lat !== yj > lat &&
      lng <
        ((xj - xi) * (lat - yi)) /
          (yj - yi) +
          xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}


function getBuildingCenter(geometry) {
  if (!geometry?.length) return null;

  let lat = 0;
  let lng = 0;

  geometry.forEach((p) => {
    lat += p.lat;
    lng += p.lon;
  });

  return {
    lat: lat / geometry.length,
    lng: lng / geometry.length,
  };
}


function findNearestBuilding(objekt, buildings) {
  let selected = null;
  let minDistance = Infinity;

  for (const building of buildings) {
    if (!building.geometry?.length) continue;

    // Nëse pika e Kadastrës bie brenda shtëpisë
    if (
      pointInsideBuilding(
        objekt.lat,
        objekt.lng,
        building.geometry
      )
    ) {
      return {
        building,
        center: getBuildingCenter(building.geometry),
        distance: 0,
      };
    }

    // Përndryshe gjej ndërtesën më të afërt
    const center = getBuildingCenter(building.geometry);

    if (!center) continue;

    const distance = distanceMeters(
      objekt.lat,
      objekt.lng,
      center.lat,
      center.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      selected = building;
    }
  }

  // Mos e lidh me ndërtesë shumë larg
  if (!selected || minDistance > 60) {
    return null;
  }

  return {
    building: selected,
    center: getBuildingCenter(selected.geometry),
    distance: minDistance,
  };
}


async function getNearbyBuildings(lat, lng, signal) {
  const radius = 120;

  const query = `
    [out:json][timeout:12];
    way["building"](around:${radius},${lat},${lng});
    out geom;
  `;

  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(
          `Overpass ${response.status}`
        );
      }

      const data =
        await response.json();

      return (
        data.elements?.filter(
          (item) =>
            item.type === "way" &&
            item.geometry?.length
        ) || []
      );
    } catch (error) {
      if (
        error.name === "AbortError"
      ) {
        throw error;
      }

      lastError = error;

      console.warn(
        `Overpass dështoi te ${endpoint}`,
        error
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "Nuk u morën ndërtesat"
    )
  );
}
/* =========================================================
   COMPONENT
========================================================= */

export default function DoorToDoor() {
  const mapRef = useRef(null);
  const applicationMarkersRef = useRef({});

  const albaniaBoundsRef =
    useRef(ALBANIA_BOUNDS);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("Të gjitha");

  const [
    records,
    setRecords,
  ] = useState(INITIAL_RECORDS);

  /* =======================================================
     STATISTICS
  ======================================================= */

  const statistics =
    useMemo(() => {
      const total =
        records.length;

      const paAkses =
        records.filter(
          (item) =>
            item.status ===
            "Banesë pa akses (PIN LOCATION)"
        ).length;

      const mungeseDokumentacioni =
        records.filter(
          (item) =>
            item.status
              ?.toLowerCase()
              .startsWith(
                "mungesë dokumentacioni"
              )
        ).length;

      return {
        total,
        paAkses,
        mungeseDokumentacioni,
      };
    }, [records]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredRecords =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      return records.filter(
        (item) => {
          const matchesStatus =
            selectedStatus ===
              "Të gjitha" ||
            item.status ===
              selectedStatus;

          const searchable = [
            item.nrAplikimi,
            item.NID,
          
            item.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !q ||
            searchable.includes(q);

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      records,
      search,
      selectedStatus,
    ]);

  /* =======================================================
     MAP
  ======================================================= */

  useEffect(() => {
    let disposed = false;

    const controller =
      new AbortController();

    const container =
      document.getElementById(
        "doortodoor-map"
      );

    if (!container) {
      return;
    }

    /* =====================================================
       CLEAN OLD LEAFLET INSTANCE
    ===================================================== */

    if (container._leaflet_id) {
      container._leaflet_id =
        null;
    }

    /* =====================================================
       CREATE MAP
    ===================================================== */

    const map =
      L.map(
        container,
        {
          zoomControl: false,

          minZoom: 7,
          maxZoom: 20,

          scrollWheelZoom: true,

          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,

          preferCanvas: false,

          maxBounds:
            L.latLngBounds(
              [39.2, 18.7],
              [43.0, 21.6]
            ),

          maxBoundsViscosity: 1,
        }
      );

    mapRef.current = map;

    /* =====================================================
       PANES
    ===================================================== */

    map.createPane(
      "albaniaMask"
    );

    map.getPane(
      "albaniaMask"
    ).style.zIndex = 500;

    map.getPane(
      "albaniaMask"
    ).style.pointerEvents =
      "none";

    map.createPane(
      "albaniaBorder"
    );

    map.getPane(
      "albaniaBorder"
    ).style.zIndex = 510;

    map.getPane(
      "albaniaBorder"
    ).style.pointerEvents =
      "none";

    map.createPane(
      "doorMarkers"
    );

    map.getPane(
      "doorMarkers"
    ).style.zIndex = 650;

    /* =====================================================
       BASEMAP - SATELLITE
    ===================================================== */

/* =====================================================
   BASEMAP - SATELLITE + SAFE FALLBACK
===================================================== */

const osmFallbackLayer = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxNativeZoom: 19,
    maxZoom: 20,
    detectRetina: false,
    keepBuffer: 4,
    attribution: "&copy; OpenStreetMap contributors",
  }
);

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxNativeZoom: 18,
    maxZoom: 20,
    keepBuffer: 4,
    attribution: "Tiles © Esri",
    errorTileUrl:
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
  }
);

satelliteLayer.addTo(map);

let satelliteFailed = false;

satelliteLayer.on("tileerror", () => {
  if (satelliteFailed) return;

  satelliteFailed = true;

  console.warn(
    "Satellite imagery unavailable. Switching to OSM."
  );

  if (map.hasLayer(satelliteLayer)) {
    map.removeLayer(satelliteLayer);
  }

  if (!map.hasLayer(osmFallbackLayer)) {
    osmFallbackLayer.addTo(map);
  }
});

const CITIES = [
  { name: "Tiranë", position: [41.3275, 19.8187] },
  { name: "Durrës", position: [41.3231, 19.4414] },
  { name: "Shkodër", position: [42.0683, 19.5126] },
  { name: "Elbasan", position: [41.1125, 20.0822] },
  { name: "Fier", position: [40.7239, 19.5560] },
  { name: "Berat", position: [40.7058, 19.9522] },
  { name: "Vlorë", position: [40.4661, 19.4914] },
  { name: "Korçë", position: [40.6186, 20.7808] },
  { name: "Gjirokastër", position: [40.0758, 20.1389] },
  { name: "Sarandë", position: [39.8756, 20.0053] },
  { name: "Lezhë", position: [41.7836, 19.6436] },
  { name: "Kukës", position: [42.0769, 20.4219] },

  { name: "Pogradec", position: [40.9025, 20.6525] },
  { name: "Lushnjë", position: [40.9419, 19.7050] },
  { name: "Kavajë", position: [41.1856, 19.5569] },
  { name: "Krujë", position: [41.5092, 19.7928] },
  { name: "Laç", position: [41.6356, 19.7131] },
  { name: "Peshkopi", position: [41.6850, 20.4289] },
  { name: "Burrel", position: [41.6103, 20.0089] },
  { name: "Bulqizë", position: [41.4917, 20.2219] },
  { name: "Librazhd", position: [41.1794, 20.3158] },
  { name: "Gramsh", position: [40.8697, 20.1844] },
  { name: "Peqin", position: [41.0461, 19.7511] },
  { name: "Rrëshen", position: [41.7675, 19.8756] },
  { name: "Pukë", position: [42.0444, 19.8997] },
  { name: "Bajram Curri", position: [42.3581, 20.0758] },

  { name: "Tepelenë", position: [40.2956, 20.0189] },
  { name: "Përmet", position: [40.2336, 20.3517] },
  { name: "Delvinë", position: [39.9511, 20.0978] },
  { name: "Ballsh", position: [40.6008, 19.7364] },
  { name: "Patos", position: [40.6833, 19.6194] },
  { name: "Skrapar", position: [40.5042, 20.2272] },
  { name: "Ersekë", position: [40.3378, 20.6789] },
  { name: "Bilisht", position: [40.6211, 20.9881] },
  { name: "Kuçovë", position: [40.8003, 19.9167] },
  { name: "Malësi e Madhe", position: [42.2136, 19.4364] },
];

const cityMarkers = [];

CITIES.forEach((city) => {
  const cityIcon = L.divIcon({
    className: "city-label-wrapper",
    html: `<div class="city-label">${city.name}</div>`,
    iconSize: [90, 24],
    iconAnchor: [45, 12],
  });

  const marker = L.marker(city.position, {
    icon: cityIcon,
    interactive: false,
    pane: "doorMarkers",
  }).addTo(map);

  cityMarkers.push(marker);
});

    

    /* =====================================================
       ALBANIA GEOJSON
    ===================================================== */

    fetch(
      `${
        import.meta.env.BASE_URL
      }geojson/newjson/gadm41_ALB_0.geojson`,
      {
        signal:
          controller.signal,
      }
    )
      .then(
        (response) => {
          if (!response.ok) {
            throw new Error(
              `GeoJSON nuk u ngarkua. Status: ${response.status}`
            );
          }

          return response.json();
        }
      )

      .then(
        (albaniaData) => {
          if (
            disposed ||
            mapRef.current !== map
          ) {
            return;
          }

          const holes = [];

          /* ===============================================
             READ POLYGON
          =============================================== */

          const addPolygon =
            (coordinates) => {
              if (
                !coordinates?.length
              ) {
                return;
              }

              const outer =
                coordinates[0];

              const ring =
                outer.map(
                  ([lng, lat]) => [
                    lat,
                    lng,
                  ]
                );

              holes.push(ring);
            };

          const readGeometry =
            (geometry) => {
              if (!geometry) {
                return;
              }

              if (
                geometry.type ===
                "Polygon"
              ) {
                addPolygon(
                  geometry.coordinates
                );
              }

              if (
                geometry.type ===
                "MultiPolygon"
              ) {
                geometry.coordinates.forEach(
                  (polygon) => {
                    addPolygon(
                      polygon
                    );
                  }
                );
              }
            };

          if (
            albaniaData.type ===
            "FeatureCollection"
          ) {
            albaniaData.features.forEach(
              (feature) => {
                readGeometry(
                  feature.geometry
                );
              }
            );
          } else if (
            albaniaData.type ===
            "Feature"
          ) {
            readGeometry(
              albaniaData.geometry
            );
          } else {
            readGeometry(
              albaniaData
            );
          }

          if (
            disposed ||
            mapRef.current !== map
          ) {
            return;
          }

          /* ===============================================
             WHITE OUTSIDE ALBANIA
          =============================================== */

          L.polygon(
            [
              WORLD,
              ...holes,
            ],
            {
              pane:
                "albaniaMask",

              stroke: false,

              fill: true,

              fillColor:
                "#ffffff",

              fillOpacity: 1,

              fillRule:
                "evenodd",

              interactive:
                false,
            }
          ).addTo(map);

          if (
            disposed ||
            mapRef.current !== map
          ) {
            return;
          }

          /* ===============================================
             ALBANIA BORDER
          =============================================== */

          const albaniaLayer =
            L.geoJSON(
              albaniaData,
              {
                pane:
                  "albaniaBorder",

                style: {
                  color:
                    "#64748b",

                  weight: 1.3,

                  opacity: 0.8,

                  fillOpacity: 0,
                },
              }
            ).addTo(map);

          const bounds =
            albaniaLayer.getBounds();

          if (
            !bounds.isValid()
          ) {
            return;
          }

          albaniaBoundsRef.current =
            bounds;

          if (
            !disposed &&
            mapRef.current === map
          ) {
            map.fitBounds(
              bounds,
              {
                padding: [
                  30,
                  30,
                ],

                animate: false,
              }
            );

          }
        }
      )

      .catch(
        (error) => {
          if (
            error.name ===
            "AbortError"
          ) {
            return;
          }

          if (disposed) {
            return;
          }

          console.error(
            "Gabim në ngarkimin e GeoJSON:",
            error
          );
        }
      );

    /* =====================================================
       ZOOM
    ===================================================== */

    L.control
      .zoom({
        position:
          "bottomright",
      })
      .addTo(map);

    /* =====================================================
       SCALE
    ===================================================== */

    L.control
      .scale({
        position:
          "bottomleft",

        imperial: false,
      })
      .addTo(map);

    /* =====================================================
       PALASE ICON
    ===================================================== */

    const palaseIcon =
      L.divIcon({
        className:
          "doortodoor-palase-icon-wrapper",

        html: `
          <div class="doortodoor-palase-marker">

            <div class="doortodoor-palase-pin">
              <span></span>
            </div>

            <div class="doortodoor-palase-name">
              Palasë
            </div>

          </div>
        `,

        iconSize: [
          110,
          55,
        ],

        iconAnchor: [
          18,
          44,
        ],

        popupAnchor: [
          0,
          -42,
        ],
      });

    const palaseMarker =
      L.marker(
        PALASE.position,
        {
          icon:
            palaseIcon,

          title:
            "Palasë",

          pane:
            "doorMarkers",

          zIndexOffset:
            1000,
        }
      ).addTo(map);

    /* =====================================================
       PALASE POPUP
    ===================================================== */

    palaseMarker.bindPopup(`
      <div class="doortodoor-popup">

        <strong>
          Palasë
        </strong>

        <div class="popup-row">
          <span>DV</span>
          <b>Vlorë</b>
        </div>

        <div class="popup-row">
          <span>Bashkia</span>
          <b>Himarë</b>
        </div>

        <div class="popup-row">
          <span>Nj. Adm.</span>
          <b>Palasë</b>
        </div>

        <div class="popup-row">
          <span>Periudha</span>
          <b>
            09.09.2026 - 17.09.2026
          </b>
        </div>

      </div>
    `);

    /* =====================================================
       CLICK PALASE
    ===================================================== */

    palaseMarker.on(
      "click",
      () => {
        if (
          disposed ||
          mapRef.current !== map
        ) {
          return;
        }

        map.setView(
          PALASE.position,
          17,
          {
            animate: false,
          }
        );
      }
    );

    /* =====================================================
       HOUSE MARKERS
    ===================================================== */
     /* =====================================================
   HOUSE MARKERS
   - Marker-at krijohen nga koordinatat e records
   - Nuk shfaqen në pamjen e Shqipërisë
   - Shfaqen vetëm kur zoom >= 16
===================================================== */

const HOUSE_MARKER_MIN_ZOOM = 16;

const houseMarkers = [];

records.forEach((objekt) => {
  /* -------------------------------------------------
     Kontrollo koordinatat
  ------------------------------------------------- */

  if (
    !Number.isFinite(objekt.lat) ||
    !Number.isFinite(objekt.lng)
  ) {
    return;
  }

  /* -------------------------------------------------
     STATUSI I OBJEKTIT
  ------------------------------------------------- */

  const statusLower =
    objekt.status?.toLowerCase() || "";

  let markerClass = "status-default";

  if (
    statusLower.startsWith(
      "mungesë dokumentacioni"
    )
  ) {
    markerClass = "status-missing";
  } else if (
    objekt.status === "Pajisur me Vendim"
  ) {
    markerClass = "status-approved";
  } else if (
    objekt.status === "Afishim Publik"
  ) {
    markerClass = "status-public";
  } else if (
    objekt.status ===
    "Banesë pa akses (PIN LOCATION)"
  ) {
    markerClass = "status-no-access";
  }

  /* -------------------------------------------------
     IKONA E SHTËPISË
  ------------------------------------------------- */

  const houseIcon = L.divIcon({
    className: "door-house-wrapper",

    html: `
      <div class="door-house-marker ${markerClass}">
        <span class="door-house-symbol">⌂</span>
      </div>
    `,

    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });

  /* -------------------------------------------------
     KRIJO MARKER-IN

     E RËNDËSISHME:
     Nuk përdorim .addTo(map) këtu.

     Marker-i do të shtohet vetëm kur zoom >= 16.
  ------------------------------------------------- */

  const houseMarker = L.marker(
    [
      objekt.lat,
      objekt.lng,
    ],
    {
      icon: houseIcon,
      pane: "doorMarkers",
      zIndexOffset: 900,
      draggable: false,
    }
  );

  /* -------------------------------------------------
     RUAJE MARKER-IN
  ------------------------------------------------- */

  houseMarkers.push(houseMarker);
  applicationMarkersRef.current[objekt.id] = houseMarker;

  /* -------------------------------------------------
     TOOLTIP
  ------------------------------------------------- */

  houseMarker.bindTooltip(
    objekt.nrAplikimi,
    {
      direction: "top",
      offset: [0, -18],
    }
  );

  /* -------------------------------------------------
     POPUP
  ------------------------------------------------- */

  houseMarker.bindPopup(`
    <div class="house-popup">

      <h3>
        ${objekt.nrAplikimi}
      </h3>

      <div class="house-popup-row">
        <span>Aplikanti</span>

      </div>

      <div class="house-popup-row">
        <span>Fshati</span>

        <strong>
          ${PALASE.fshati}
        </strong>
      </div>

      <div class="house-popup-row">
        <span>Statusi</span>

        <strong>
          ${objekt.status}
        </strong>
      </div>

      <div class="house-popup-row">
        <span>Koordinata</span>

        <strong>
          ${objekt.lat.toFixed(8)},
          ${objekt.lng.toFixed(8)}
        </strong>
      </div>

    </div>
  `);

  /* -------------------------------------------------
     CLICK TE SHTËPIA
  ------------------------------------------------- */

  houseMarker.on("click", () => {
    if (
      disposed ||
      mapRef.current !== map
    ) {
      return;
    }

    map.setView(
      [
        objekt.lat,
        objekt.lng,
      ],
      19,
      {
        animate: false,
      }
    );
  });
});


/* =====================================================
   SHOW / HIDE HOUSE MARKERS
===================================================== */

const updateHouseMarkers = () => {
  if (
    disposed ||
    mapRef.current !== map
  ) {
    return;
  }

  const zoom = map.getZoom();

  houseMarkers.forEach(
    (houseMarker) => {

      /*
       * ZOOM >= 16
       * Shfaq marker-in.
       */

      if (
        zoom >= HOUSE_MARKER_MIN_ZOOM
      ) {
        if (
          !map.hasLayer(houseMarker)
        ) {
          houseMarker.addTo(map);
        }
      }

      /*
       * ZOOM < 16
       * Fshihe marker-in.
       */

      else {
        if (
          map.hasLayer(houseMarker)
        ) {
          map.removeLayer(
            houseMarker
          );
        }
      }
    }
  );
};


/* =====================================================
   LISTEN FOR ZOOM
===================================================== */

map.on(
  "zoomend",
  updateHouseMarkers
);


/* =====================================================
   INITIAL CHECK
===================================================== */

updateHouseMarkers();

    /* =====================================================
       MAP CLICK
       Vetëm për të parë koordinatën e pikës së klikuar.
    ===================================================== */

    const handleMapClick =
      (event) => {
        console.log(
          "MAP COORDINATES:",
          event.latlng.lat,
          event.latlng.lng
        );
      };

    map.on(
      "click",
      handleMapClick
    );

    /* =====================================================
       BACK TO ALBANIA
    ===================================================== */

    const AlbaniaControl =
      L.Control.extend({
        options: {
          position:
            "topright",
        },

        onAdd: () => {
          const div =
            L.DomUtil.create(
              "div",
              "albania-control"
            );

          div.innerHTML = `
            <button
              type="button"
              class="albania-control-button"
            >
              ← Shqipëria
            </button>
          `;

          L.DomEvent
            .disableClickPropagation(
              div
            );

          L.DomEvent
            .disableScrollPropagation(
              div
            );

          const button =
            div.querySelector(
              "button"
            );

          button?.addEventListener(
            "click",
            () => {
              if (
                disposed ||
                mapRef.current !== map
              ) {
                return;
              }

              map.fitBounds(
                albaniaBoundsRef.current,
                {
                  padding: [
                    30,
                    30,
                  ],

                  animate:
                    false,
                }
              );
            }
          );

          return div;
        },
      });

    map.addControl(
      new AlbaniaControl()
    );

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      disposed = true;

      controller.abort();

      map.off(
        "zoomend",
        updateHouseMarkers
      );

      map.off(
        "click",
        handleMapClick
      );

      palaseMarker.off();

      houseMarkers.forEach(
        (marker) => {
          marker.off();
        }
      );

      try {
        map.stop();
      } catch {
        // ignore
      }

      map.off();

      if (
        mapRef.current === map
      ) {
        mapRef.current =
          null;
      }

      try {
        map.remove();
      } catch (error) {
        console.warn(
          "Leaflet cleanup:",
          error
        );
      }

      if (container) {
        container._leaflet_id =
          null;
      }
    };
  }, []); // E RËNDËSISHME: vetëm një herë

  const openApplicationOnMap = (item) => {
  const map = mapRef.current;
  const marker = applicationMarkersRef.current[item.id];

  if (!map || !marker) return;

  if (!map.hasLayer(marker)) {
    marker.addTo(map);
  }

  map.setView(
    [item.lat, item.lng],
    19,
    {
      animate: false,
    }
  );

  setTimeout(() => {
    marker.openPopup();
  }, 50);
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
                src={`${import.meta.env.BASE_URL}images/logo1.jpg`}
                alt="Agjencia Shtetërore e Kadastrës"
                className="doortodoor-logo-img"
                style={{ width: "150px", height: "auto" }}
                />

      </header>

      {/* MAIN */}

      <div className="doortodoor-main">

        {/* MAP */}

        <section className="doortodoor-map-section">

          <div
            id="doortodoor-map"
            className="doortodoor-map"
          />

        </section>

        {/* DASHBOARD */}

        <aside className="doortodoor-dashboard">

          {/* AREA */}

          <section className="area-header">

            <div>

              <span className="area-label">
                Zona aktive
              </span>

              <h2>
                Palasë
              </h2>

              <div className="area-location">

                <span>
                  Vlorë
                </span>

                <span>
                  •
                </span>

                <span>
                  Himarë
                </span>

              </div>

            </div>

            <span className="area-status">
              Në proces
            </span>

          </section>

          {/* PERIOD */}

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

          {/* KPI */}

          <section className="dashboard-kpis">

            <div className="kpi-card">

              <span>
                Aplikime
              </span>

              <strong>
                {statistics.total}
              </strong>

            </div>


            <div className="kpi-card kpi-orange">

              <span>
                Mungesë dokumentacioni
              </span>

              <strong>
                {statistics.mungeseDokumentacioni}
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

          {/* SEARCH */}

          <section className="dashboard-section">

            <div className="dashboard-section-title">

              <h3>
                Kërko aplikim
              </h3>

            </div>

            <div className="dashboard-search">

              <span>
                ⌕
              </span>

              <input
                type="text"

                value={search}

                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }

                placeholder="NID.."
              />

            </div>

          </section>

          {/* STATUS */}

          <section className="dashboard-section">

            <div className="dashboard-section-title">

              <h3>
                Statusi
              </h3>

            </div>

            <select
              className="status-select"

              value={
                selectedStatus
              }

              onChange={(event) =>
                setSelectedStatus(
                  event.target.value
                )
              }
            >

              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}

            </select>

          </section>

          {/* APPLICATIONS */}

          <section className="dashboard-section applications-section">

            <div className="dashboard-section-title">

              <h3>
                Aplikime të trajtuara
              </h3>

              <span>
                {filteredRecords.length}
              </span>

            </div>

            <div className="applications-list">

              {filteredRecords.length ===
              0 ? (

                <div className="empty-applications">

                  <div className="empty-icon">
                    ⌂
                  </div>

                  <strong>
                    Nuk ka aplikime të regjistruara
                  </strong>

                  <p>
                    Nuk u gjetën rezultate për filtrin e zgjedhur.
                  </p>

                </div>

              ) : (

                filteredRecords.map(
                  (item) => (

                  <article
                    className="application-card"
                    key={item.id}
                    onClick={() => openApplicationOnMap(item)}
                    >

                      <div className="application-main">

                        <strong>
                          {item.nrAplikimi}
                          {" — "}
                         
                        </strong>

                        <span>
                          {item.status}
                        </span>

                      </div>

                    </article>

                  )
                )

              )}

            </div>

          </section>

        </aside>

      </div>

      {/* FOOTER */}

      <footer className="doortodoor-footer">
        © Agjencia Shtetërore e Kadastrës
      </footer>

    </div>
  );
}