import { useEffect, useMemo, useRef, useState } from "react";

import L from "leaflet";

import { useSearchParams } from "react-router-dom";

import "leaflet/dist/leaflet.css";

import "./doortodoor.css";

import zonesData from "./data/zones-public.json";
import calendarData from "./data/calendar.json";


const BASE_URL = import.meta.env.BASE_URL || "/";
const API_URL = `${BASE_URL}api/doortodoor`;

async function authRequest(action, payload) {
  const response = await fetch(`${API_URL}/${action}`, {
    method: payload ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: payload ? { "Content-Type": "application/json" } : {},
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Kërkesa dështoi.");
  return data;
}

const NO_ACCESS_STATUS = "Banesë pa akses (PIN LOCATION)";

const POINT_GEOJSON_FILES = new Set([
  "NE AFISHIM_perf.geojson",
  "PALASE_Ndertesat_total_POINT_perf.geojson",
  "ILIAS_Ndertesat_total_POINT.geojson",
  "PALASE_TE_GJITHA_perf.geojson",
]);

function getGeometryDuplicateKey(feature, zone, type) {
  const geometry = feature?.geometry;
  if (!geometry?.coordinates) return null;

  const roundedCoordinates = JSON.stringify(geometry.coordinates, (_key, value) =>
    typeof value === "number" ? Math.round(value * 1e7) / 1e7 : value
  );

  return `${zone}|${type}|${geometry.type}|${roundedCoordinates}`;
}

const GEOJSON_FILES = [

  // { file: "palas_gjilek.geojson", name: "Palasë – Gjilek", zone: "palase", type: "parcel" },

  //{ file: "palas_gjilek_nd.geojson", name: "Palasë – Gjilek ND", zone: "palase", type: "building" },

  // { file: "palas_gjilek_shtes.geojson", name: "Palasë – Gjilek shtesë", zone: "palase", type: "parcel" },

  // { file: "palas_gjilek_nd_shtes.geojson", name: "Palasë – Gjilek ND shtesë", zone: "palase", type: "building" },

  { file: "PARCELA1.geojson", name: "Dhërmi – Parcelat", zone: "dhermi", type: "parcel" },

  { file: "NDERTES1.geojson", name: "Dhërmi – Ndërtesat", zone: "dhermi", type: "building" },

  // { file: "Palase_Parcela.geojson", name: "Palasë – Parcelat", zone: "palase", type: "parcel" },

  // { file: "Palase_Ndertesat.geojson", name: "Palasë – Ndërtesat", zone: "palase", type: "building" },

  //{ file: "Jugu_Ndertesat_total.geojson", name: "Jug – Ndërtesat", zone: "jug", type: "building" },

  // { file: "palase_google_earth.geojson",  name: "Palasë – Pika", zone: "palase-pika",type: "parcel",},

  // { file: "Jugu_Ndertesat_total_POINT_PALASE.geojson", name: "Palasë – Ndërtesat Jugu", zone: "palase", type: "building", display: "point" },

  // { file: "PALASE_MATJE_2.geojson", name: "Palasë – Matje", zone: "palase", type: "parcel" },

  // { file: "PALASE_TE_GJITHA.geojson", name: "Palasë – Të gjitha", zone: "palase", type: "parcel" },

  //{ file: "NE AFISHIM.geojson", name: "Palasë – Në afishim", zone: "palase", type: "parcel", display: "point", colorType: "afishim" },

  // { file: "PALASE_Ndertesat_total_POINT1.geojson", name: "Palasë – Ndërtesat", zone: "palase", type: "building", display: "point" },

  // { file: "PALASE_TE_GJITHA1.geojson", name: "Palasë – Të gjitha 1", zone: "palase", type: "parcel" },

  { file: "ILIAS_FSHAT_krgjsh.geojson", name: "Ilias – Fshati", zone: "ilias", type: "parcel" },

  { file: "ILIAS_NDERTESAT.geojson", name: "Ilias – Ndërtesat", zone: "ilias", type: "building" },

  { file: "ILIAS_Ndertesat_total_POINT.geojson", name: "Ilias – Ndërtesat POINT", zone: "ilias", type: "building", display: "point" },

  { file: "ILIAS_PARCELAT.geojson", name: "Ilias – Parcelat", zone: "ilias", type: "parcel" },

  { file: "Ndertesat_Ilias_privat.geojson", name: "Ilias – Ndërtesat private", zone: "ilias", type: "building", colorType: "regjistruar" },

  { file: "Ndertesat_Dhermi_privat.geojson", name: "Dhërmi – Ndërtesat private", zone: "dhermi", type: "building", colorType: "regjistruar" },

  { file: "Ndertesat_Palase_privat.geojson", name: "Palasë – Ndërtesat private", zone: "palase", type: "building", colorType: "regjistruar" },
  { file: "NE AFISHIM_perf.geojson", name: "Palasë – Në afishim", zone: "palase", type: "parcel", display: "point", colorType: "afishim" },
  { file: "PALASE_Ndertesat_total_POINT_perf.geojson", name: "Palasë – Banesa pa akses", zone: "palase", type: "building", display: "point", colorType: "noAccess" },
  { file: "PALASE_TE_GJITHA_perf.geojson", name: "Palasë – Evidentime në terren", zone: "palase", type: "survey", display: "point" },

];

const ZONES = GEOJSON_FILES.reduce((zones, item) => {

  const zone = (zones[item.zone] ??= {

    name: item.zone,

    dv: "—",

    bashkia: "—",

    periudha: "—",

  });

  if (item.zoneName) zone.name = item.zoneName;

  if (item.dv) zone.dv = item.dv;

  if (item.bashkia) zone.bashkia = item.bashkia;

  if (item.periudha) zone.periudha = item.periudha;

  return zones;

}, {});

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

  regjistruar: {

    color: "#7e22ce",

    fillColor: "#a855f7",

    weight: 2,

    opacity: 1,

    fillOpacity: 0.45,

  },

  afishim: { color: "#1d4ed8", fillColor: "#3b82f6", weight: 2, opacity: 1, fillOpacity: 0.4 },

  point: { color: "#a16207", fillColor: "#facc15", weight: 2, opacity: 1, fillOpacity: 0.9 },

  noAccess: {

    color: "#b91c1c",

    fillColor: "#ef4444",

    weight: 2.5,

    opacity: 1,

    fillOpacity: 0.35,

  },

};

const getPropertyLabelSize = (zoom) => {

  if (zoom <= 12) return 0;

  if (zoom <= 14) return 8;

  if (zoom <= 16) return 10;

  return 12;

};

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
    "shenime",
    "shënime",
    "pershkrimi",
    "përshkrimi",
  ]);

  const status = normalize(rawStatus)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

  if (
    status.includes("pa akses") ||
    status.includes("no access") ||
    status.includes("pin location")
  ) {
    return NO_ACCESS_STATUS;
  }

  if (
    status.includes("mungese dokumentacioni") ||
    status.includes("mungon dokumentacioni") ||
    status.includes("pa dokumentacion") ||
    status.includes("nuk ka dosje") ||
    status.includes("s ka dosje")
  ) {
    return "Mungesë dokumentacioni";
  }

  if (
    status.includes("proces gjyqesor") ||
    status.includes("ne proces") ||
    status.includes("tjeter") ||
    status.includes("te tjera")
  ) {
    return "Të tjera";
  }

  if (status.includes("afishim")) {
    return "Në afishim";
  }

  if (status.includes("regjistruar")) {
    return "Regjistruar";
  }

  return rawStatus
    ? String(rawStatus)
    : "Status i papërcaktuar";
}

function getStatusCategory(status) {
  const value = normalize(status).replace(/[_-]/g, " ").replace(/\s+/g, " ");
  if (value.includes("pa akses") || value.includes("pin location")) return "paAkses";
  if (value.includes("munges") && (value.includes("dokument") || value.includes("dosje"))) return "mungeseDokumentacioni";
  if (value.includes("ska dosje") || value.includes("s'ka dosje") || value.includes("nuk ka dosje")) return "mungeseDokumentacioni";
  if (value.includes("afishim")) return "afishim";
  if (value.includes("miratuar me vendim") || value.includes("pajisur me vendim")) return "miratuar";
  if (value.includes("regjistruar")) return "regjistruar";
  if (value.includes("proces gjyqesor") || value.includes("tjeter") || value.includes("te tjera")) return "teTjera";
  if (value === "evidentuar") return "evidentuar";
  return "papercaktuar";
}

function normalizePersonName(value) {
  return normalize(value).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function getSurveyStatus(properties) {
  return properties?._resolvedStatus || "Evidentuar";
}

function getFeatureStyle(isBuilding, properties, source = {}) {

  if (source.colorType === "afishim") {

    return {

      ...COLORS.afishim,

      fillOpacity: 0.9,

    };

  }

  if (source.colorType === "noAccess") return { ...COLORS.noAccess };
  if (source.type === "survey") {
    const category = getStatusCategory(getSurveyStatus(properties));
    if (category === "paAkses") return { ...COLORS.noAccess };
    if (category === "miratuar") return { color: "#0f766e", fillColor: "#14b8a6", weight: 2, fillOpacity: 0.9 };
    if (category === "mungeseDokumentacioni") return { color: "#a16207", fillColor: "#facc15", weight: 2, fillOpacity: 0.9 };
    if (category === "teTjera") return { color: "#475569", fillColor: "#94a3b8", weight: 2, fillOpacity: 0.9 };
    return { color: "#92400e", fillColor: "#fb923c", weight: 2, fillOpacity: 0.9 };
  }

  const category = getStatusCategory(getStatus(properties));
  if (category === "mungeseDokumentacioni") {
    return { color: "#a16207", fillColor: "#facc15", weight: 2, opacity: 1, fillOpacity: 0.75 };
  }
  if (category === "teTjera") {
    return { color: "#475569", fillColor: "#94a3b8", weight: 2, opacity: 1, fillOpacity: 0.7 };
  }

  if (source.colorType === "regjistruar") {

    return { ...COLORS.regjistruar };

  }

  if (isBuilding && getStatus(properties) === NO_ACCESS_STATUS) {

    return { ...COLORS.noAccess };

  }

  if (POINT_GEOJSON_FILES.has(source.file)) {

    if (
      source.file === "PALASE_Ndertesat_total_POINT_perf.geojson" ||
      source.file === "PALASE_Ndertesat_total_POINT1.geojson" ||
      source.file === "Jugu_Ndertesat_total_POINT_PALASE.geojson"
    ) {
      return source.colorType === "noAccess" ? { ...COLORS.noAccess } : { ...COLORS.point };
    }

  }

  return { ...(isBuilding ? COLORS.building : COLORS.parcel) };

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

function createPolygonLabel(properties, isBuilding = false) {

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

      "property_n",

      "Numri_i_pa",

      "label",

    ]) ?? ""

    : getProperty(properties, [

      "nr_pas",

      "NR_PASURIE",

      "nr_pasurie",

      "Nr_Pas",

      "NR_PAS",

      "NrPas",

      "property_n",

      "Numri_i_pa",

      "label",

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

function getPointRadius(zoom) {
  if (zoom <= 10) return 1;
  if (zoom <= 12) return 1.5;
  if (zoom <= 14) return 2.5;
  if (zoom <= 16) return 4;
  if (zoom <= 18) return 5;
  return 6;
}

export default function DoorToDoor() {
  const [auth, setAuth] = useState({ ready: false, user: null });
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const authenticated = Boolean(auth.user);
  const sessionVersion = auth.user?.expiresAt || 0;

  useEffect(() => {
    let active = true;
    const check = () => authRequest("session")
      .then(data => { if (active) setAuth({ ready: true, user: data.user }); })
      .catch(() => { if (active) setAuth({ ready: true, user: null }); });
    check();
    const interval = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => { active = false; clearInterval(interval); window.removeEventListener("focus", check); };
  }, []);

  useEffect(() => {
    if (!sessionVersion) return;
    const timer = setTimeout(() => setAuth({ ready: true, user: null }), Math.max(0, sessionVersion - Date.now()));
    return () => clearTimeout(timer);
  }, [sessionVersion]);

  async function login(event) {
    event.preventDefault();
    setAuthBusy(true); setAuthError("");
    try {
      const data = await authRequest("login", { username, password });
      setAuth({ ready: true, user: data.user });
      setPassword(""); setLoginOpen(false);
    } catch (error) { setAuthError(error.message); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    setAuthBusy(true); setAuthError("");
    try {
      await authRequest("logout", {});
      setAuth({ ready: true, user: null });
    } catch (error) { setAuthError(error.message); }
    finally { setAuthBusy(false); }
  }

  const mapContainerRef = useRef(null);

  const mapRef = useRef(null);

  const featureLayersRef = useRef({});

  const zoneLayersRef = useRef({});

  const zoneBoundsRef = useRef({});

  const [searchParams] = useSearchParams();

  const zoneFromUrl = searchParams.get("zone");

  const [selectedZone, setSelectedZone] = useState(
    () => ZONES[zoneFromUrl] ? zoneFromUrl : "palase"
  );

  useEffect(() => {
    if (ZONES[zoneFromUrl]) {
      setSelectedZone(zoneFromUrl);
    }
  }, [zoneFromUrl]);

  const activeZone = ZONES[selectedZone];

 const periudhaEvidentimit = useMemo(() => {
  const zoneName = normalize(selectedZone);

  const calendarEntry = calendarData.find((item) =>
    item.locations?.some(
      (location) => normalize(location) === zoneName
    )
  );

  if (!calendarEntry) return "—";

  // Prefer village-specific dates when available.
  const locationDates = Object.entries(
    calendarEntry.locationDates || {}
  ).find(([location]) => normalize(location) === zoneName)?.[1];

  const startDate =
    locationDates?.startDate || calendarEntry.startDate;

  const endDate =
    locationDates?.endDate || calendarEntry.endDate;

  if (!startDate || !endDate || startDate === "-" || endDate === "-") {
    return "—";
  }

  return `${startDate} – ${endDate}`;
}, [selectedZone]);

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

      if (showLabels) {

        layer.openTooltip();

      } else {

        layer.closeTooltip();

      }

    });

  };

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
    const byType = (type) => zoneRecords.filter((item) => item.type === type).length;
    const byCategory = (category) => zoneRecords.filter((item) => getStatusCategory(item.status) === category).length;
    return {
      total: zoneRecords.length,
      parcels: byType("parcel"),
      buildings: byType("building"),
      evidentime: byType("survey"),
      afishim: byCategory("afishim"),
      regjistruar: byCategory("regjistruar"),
      paAkses: byCategory("paAkses"),
      miratuar: byCategory("miratuar"),
      mungeseDokumentacioni: byCategory("mungeseDokumentacioni"),
      teTjera: byCategory("teTjera"),
      paStatus: byCategory("papercaktuar"),
      evidentimePaStatus: zoneRecords.filter((item) => item.type === "survey" && getStatusCategory(item.status) === "evidentuar").length,
    };
  }, [zoneRecords]);

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

  useEffect(() => {

    if (!auth.ready || !mapContainerRef.current) return;

    if (mapRef.current) return;

    setRecords([]);
    setSelectedRecord(null);
    setLoading(true);
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

    const updatePropertyLabels = () => {
      if (disposed || mapRef.current !== map) return;
      const zoom = map.getZoom();
      map.getContainer().style.setProperty(
        "--property-label-size", `${getPropertyLabelSize(zoom)}px`
      );
      Object.values(zoneLayersRef.current).forEach((entries) => {
        entries.forEach(({ layer: group }) => {
          group.eachLayer((featureLayer) => {
            if (!featureLayer.getTooltip?.()) return;
            if (zoom > 12 && map.hasLayer(group)) featureLayer.openTooltip();
            else featureLayer.closeTooltip();
          });
        });
      });
    };

    const updatePointSizes = () => {
      const zoom = map.getZoom();

      Object.values(zoneLayersRef.current).forEach((entries) => {
        entries.forEach(({ layer }) => {
          layer.eachLayer((featureLayer) => {
            if (featureLayer instanceof L.CircleMarker) {
              featureLayer.setStyle({
                radius: getPointRadius(zoom),
                weight: zoom <= 12 ? 0.5 : 1.5,
                fillOpacity: zoom <= 12 ? 0.55 : 0.9,
              });
            }
          });
        });
      });
    };

    map.on("zoomend", updatePointSizes);

    map.on("zoomend", updatePropertyLabels);

    mapRef.current = map;

    map.fitBounds(ALBANIA_BOUNDS, {

      padding: [25, 25],

      animate: false,

    });

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

        "auto";

      map.getPane("buildingPane").style.pointerEvents =

        "auto";

    };

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

    const LegendControl = L.Control.extend({

      options: { position: "bottomleft" },

      onAdd() {

        const div = L.DomUtil.create("div", "doortodoor-map-legend");

        div.innerHTML = authenticated ? `

        <strong>Legjenda</strong>
        <div><i style="background:#f97316;border:2px solid #ea580c"></i> Parcelat</div>

        <div><i style="background:#22c55e;border:2px solid #15803d"></i> Ndërtesat</div>

        <div><i class="legend-point" style="background:#3b82f6;border:2px solid #1d4ed8"></i> Në afishim</div>

        <div><i class="legend-point" style="background:#a855f7;border:2px solid #7e22ce"></i> Regjistruar</div>

        <div><i class="legend-point" style="background:#ef4444;border:2px solid #b91c1c"></i> Banesë pa akses</div>
        <div><i style="background:#facc15;border:2px solid #a16207"></i> Mungesë dokumentacioni</div>
        <div><i style="background:#94a3b8;border:2px solid #475569"></i> Të tjera</div>
        <div><i class="legend-point" style="background:#100cea;border:2px solid #100cea"></i> Evidentime në terren</div>` : `<strong>Legjenda</strong><div><i class="legend-point" style="background:#ef4444;border:2px solid #b91c1c"></i> Banesë pa akses</div>`;

        L.DomEvent.disableClickPropagation(div);

        L.DomEvent.disableScrollPropagation(div);

        return div;

      },

    });

    map.addControl(new LegendControl());

    const allRecords = [];

    const seenGeoJSONFeatures = new Set();
    let skippedDuplicates = 0;

    const boundsByZone = {};

    const parcelLayers = [];

    const buildingLayers = [];

    let generatedId = 0;

    async function loadGeoJSON() {

      setLoading(true);

      setError("");

      const failedFiles = [];

      for (const source of GEOJSON_FILES) {

        if (disposed) return;

        try {

          const url =

            `${API_URL}/geojson?file=${encodeURIComponent(source.file)}&scope=${authenticated ? "all" : "public"}`;

          const response = await fetch(url, {

            signal: controller.signal,
            credentials: "same-origin",
            cache: "no-store",
          });

          if (response.status === 401) {
            if (!disposed) setAuth({ ready: true, user: null });
            return;
          }
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

          const isPointSource = POINT_GEOJSON_FILES.has(source.file);

          const allFeatures = getFeatures(data).filter(isValidGeometry);

          const allowedGeometries = isPointSource

            ? new Set(["Point", "MultiPoint"])

            : new Set(["Polygon", "MultiPolygon"]);

          const features = allFeatures.filter((feature) => {
            if (!allowedGeometries.has(feature.geometry.type)) return false;

            const key = getGeometryDuplicateKey(feature, source.zone, source.type);
            if (key && seenGeoJSONFeatures.has(key)) {
              skippedDuplicates += 1;
              return false;
            }
            if (key) seenGeoJSONFeatures.add(key);
            return true;
          });

          if (features.length === 0) {

            const geometryTypes = [...new Set(allFeatures.map((f) => f.geometry.type))];

            console.warn(

              `[GeoJSON] ${source.file}: nuk ka ${isPointSource ? "pika" : "poligone"} për t'u vizatuar.`,

              "Gjeometritë në skedar:", geometryTypes

            );

          }

          const isBuilding =

            source.type === "building";

          console.log(

            `${source.file}: ${features.length} objekte`

          );

          const geojsonLayer = L.geoJSON(features, {

            pane: isBuilding

              ? "buildingPane"

              : "parcelPane",

            interactive: true,

            bubblingMouseEvents: false,

            pointToLayer: (feature, latlng) => {
              const style = getFeatureStyle(
                isBuilding,
                feature.properties || {},
                source
              );

              return L.circleMarker(latlng, {
                ...style,
                radius: getPointRadius(map.getZoom()),
                weight: map.getZoom() <= 12 ? 0.5 : 1.5,
                fillOpacity: map.getZoom() <= 12 ? 0.55 : 0.9,
                pane: isBuilding ? "buildingPane" : "parcelPane",
              });
            },

            style: (feature) => {

              return getFeatureStyle(isBuilding, feature.properties || {}, source);

            },

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

              const nrAplikimi =

                getProperty(properties, [

                  "nrAplikimi",

                  "NR_APLIKIMI",

                  "NR_UNIK",

                  "OBJECTID",

                  "ID",

                ]) || `PAL-${String(generatedId).padStart(3, "0")}`;

              const nrPasurie =

                getProperty(properties, [

                  "nr_pasuris",

                  "nr_pasurie",

                  "NR_PASURIE",

                  "Nr_Pas",

                  "NR_PAS",

                  "NrPas",

                  "pasuria",

                  "STRING",

                  "Numri_i_pa",
                  "property_n",
                  "label",
                  "property_n",
                  "label",

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

              const isNoAccessPoint = source.colorType === "noAccess";

              const status = properties._resolvedStatus || (source.type === "survey"
                ? getSurveyStatus(properties)
                : isNoAccessPoint
                  ? NO_ACCESS_STATUS
                  : source.colorType === "afishim"
                    ? "Në afishim"
                    : source.colorType === "regjistruar"
                      ? "Regjistruar"
                      : getStatus(properties));

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

              polygonLayer._doorToDoorType = isBuilding

                ? "building"

                : "parcel";

              polygonLayer._doorToDoorRegistered = source.colorType === "regjistruar";

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

              const popupContainer = createPopup(
                properties,
                isBuilding ? "Informacion mbi ndërtesën" : "Informacion mbi parcelën",
                status
              );
              polygonLayer.bindPopup(popupContainer, {
                maxWidth: 420,
                autoPan: true,
                closeButton: true,
              });

              const originalStyle = getFeatureStyle(isBuilding, properties, source);

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

              polygonLayer.on("mouseout", () => {

                if (typeof polygonLayer.setStyle !== "function") {

                  return;

                }

                polygonLayer.setStyle({

                  ...originalStyle,

                });

              });

              polygonLayer.on("click", (event) => {

                setSelectedRecord(record);

                polygonLayer.openPopup(event.latlng);

              });

            },

          });

          const layerEntry = {

            layer: geojsonLayer,

            name: source.name,

            zone: source.zone,

          };

          zoneLayersRef.current[source.zone] ??= [];

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

      parcelLayers.forEach(({ layer, zone }) => {

        if (zone === selectedZone) layer.addTo(map);

      });

      buildingLayers.forEach(({ layer, zone }) => {

        if (zone === selectedZone) layer.addTo(map);

      });

      zoneBoundsRef.current = boundsByZone;

      updatePropertyLabels();
      updatePointSizes();

      console.info(`[GeoJSON] Skipped ${skippedDuplicates} duplicate geometries.`);
      setRecords([...allRecords]);

      setLoading(false);

      if (failedFiles.length > 0) {

        setError(

          `Nuk u ngarkuan: ${failedFiles.join(

            " | "

          )}`

        );

      }

      const initialBounds = boundsByZone[selectedZone];

      if (initialBounds?.isValid()) {

        map.fitBounds(initialBounds, {

          padding: [45, 45],

          maxZoom: 16,

          animate: false,

        });

      }

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

    loadAlbania();

    loadGeoJSON();

    return () => {

      disposed = true;

      controller.abort();

      featureLayersRef.current = {};

      zoneLayersRef.current = {};

      zoneBoundsRef.current = {};

      map.off("zoomend", updatePropertyLabels);
      map.off("zoomend", updatePointSizes);

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

  }, [auth.ready, authenticated, sessionVersion]);

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

    Object.values(featureLayersRef.current).forEach((layer) => {

      if (!layer.getTooltip?.() || !map.hasLayer(layer)) return;

      if (map.getZoom() > 12) layer.openTooltip();

      else layer.closeTooltip();

    });

    setSelectedRecord(null);

  }, [selectedZone, loading]);

  const openApplicationOnMap = (item) => {

    const map = mapRef.current;

    if (!map || item.zone !== selectedZone) return;

    const polygonLayer =

      featureLayersRef.current[item.id];

    setSelectedRecord(item);

    if (!polygonLayer) {

      return;

    }

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

      "auto";

    buildingPane.style.pointerEvents =

      "auto";

  }, [clickMode]);

  return (

    <div className="doortodoor-page">
      <div className="door-auth-action">
        <button
          type="button"
          className="door-auth-icon"
          disabled={!auth.ready || authBusy}
          title={authenticated ? "Dil nga llogaria" : "Hyr në llogari"}
          aria-label={authenticated ? "Dil nga llogaria" : "Hyr në llogari"}
          onClick={() => {
            if (authenticated) {
              logout();
            } else {
              setAuthError("");
              setLoginOpen(true);
            }
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {authenticated ? (
              <>
                <path d="M9 5H5v14h4" />
                <path d="M9 12h12" />
                <path d="m17 8 4 4-4 4" />
              </>
            ) : (
              <>
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
              </>
            )}
          </svg>
        </button>

        {authError && !loginOpen && (
          <p className="door-auth-error" role="alert">
            {authError}
          </p>
        )}
      </div>
      {loginOpen && !authenticated && (
        <div className="door-login-overlay">
          <section
            className="door-login-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="door-login-title"
          >
            <button
              className="door-login-close"
              type="button"
              aria-label="Mbyll"
              disabled={authBusy}
              onClick={() => {
                setLoginOpen(false);
                setPassword("");
              }}
            >
              ×
            </button>

            <div className="door-login-heading">
              <span className="door-login-badge">ASHK</span>
              <h2 id="door-login-title">Hyr në platformë</h2>
              <p>
                Identifikohu për të parë të gjitha objektet dhe të dhënat e tyre.
              </p>
            </div>

            <form onSubmit={login} className="door-login-form">
              <div className="door-login-field">
                <label htmlFor="door-user">Përdoruesi</label>
                <input
                  id="door-user"
                  type="text"
                  autoFocus
                  autoComplete="username"
                  placeholder="Shkruani përdoruesin"
                  required
                  disabled={authBusy}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>

              <div className="door-login-field">
                <label htmlFor="door-password">Fjalëkalimi</label>
                <input
                  id="door-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Shkruani fjalëkalimin"
                  required
                  disabled={authBusy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {authError && (
                <p role="alert" className="door-login-error">
                  {authError}
                </p>
              )}

              <button
                className="door-login-submit"
                disabled={authBusy}
                type="submit"
              >
                {authBusy ? "Duke hyrë…" : "Hyr në llogari"}
              </button>

              <p className="door-login-note">
                Banesat pa akses mund të shihen pa u identifikuar.
              </p>
            </form>
          </section>
        </div>
      )}
      { }

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

            marginBottom: "30px",

          }}

        />

      </header>

      { }

      <div className="doortodoor-main">

        { }

        <section className="doortodoor-map-section">

          <div

            ref={mapContainerRef}

            id="doortodoor-map"

            className="doortodoor-map"

          />

        </section>

        { }

        <aside className="doortodoor-dashboard">

          { }

          { }

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

          { }

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

          { }

          <section className="period-card">

            <div className="period-icon">

              ◷

            </div>

            <div>

              <span>

                Periudha e evidentimit në terren

              </span>

              <strong>

                {periudhaEvidentimit}

              </strong>

            </div>

          </section>

          { }

          <section className="dashboard-kpis">

            <div className="kpi-card">

              <span>

                Gjeometri unike (jo domosdoshmërisht objekte të shqyrtuara)

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

          {/*

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

          */}

          { }

          <section className="dashboard-section">

            <div className="dashboard-section-title">

              <h3>Legjenda e hartës</h3>

            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>

              {[

                {

                  label: "Banesa pa akses",

                  count: statistics.paAkses,

                  color: "#ef4444",

                  border: "#b91c1c",

                  shape: "circle",

                },

                {

                  label: "Pika në afishim (lloji: parcelë)",

                  count: statistics.parcels,

                  color: "#f97316",

                  border: "#ea580c",

                  shape: "square",

                },

                {

                  label: "Ndërtesa gjithsej",

                  count: statistics.buildings,

                  color: "#22c55e",

                  border: "#15803d",

                  shape: "square",

                },

                {

                  label: "Në afishim",

                  count: statistics.afishim ?? 0,

                  color: "#3b82f6",

                  border: "#1d4ed8",

                  shape: "circle",

                },

                {

                  label: "Regjistruar",

                  count: statistics.regjistruar ?? 0,

                  color: "#a855f7",

                  border: "#7e22ce",

                  shape: "circle",

                },

                {
                  label: "Mungesë dokumentacioni",
                  count: statistics.mungeseDokumentacioni,
                  color: "#facc15",
                  border: "#a16207",
                  shape: "square",
                },
                {
                  label: "Evidentime në terren (gjithsej)",
                  count: statistics.evidentime,
                  color: "#100cea", border: "#100cea", shape: "circle",
                },
                {
                  label: "Evidentime – miratuar me vendim",
                  count: statistics.miratuar,
                  color: "#14b8a6", border: "#0f766e", shape: "circle",
                },
                {
                  label: "Evidentime – status për verifikim",
                  count: statistics.evidentimePaStatus,
                  color: "#fb923c", border: "#92400e", shape: "circle",
                },
                {
                  label: "Të tjera",
                  count: statistics.teTjera,
                  color: "#94a3b8",
                  border: "#475569",
                  shape: "square",
                },

              ].filter((item) => authenticated || item.label === "Banesa pa akses").map((item) => (

                <div

                  key={item.label}

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

                      flexShrink: 0,

                      background: item.color,

                      border: `2px solid ${item.border}`,

                      borderRadius: item.shape === "circle" ? "50%" : "3px",

                    }}

                  />

                  <span>

                    {item.label} ({item.count})

                  </span>

                </div>

              ))}

            </div>

          </section>

          { }

          {loading && (

            <section className="dashboard-section">

              <p>

                Duke ngarkuar të dhënat GeoJSON...

              </p>

            </section>

          )}

          { }

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

          { }

          { }

          { }
          { }
          { }

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

                { }

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

      { }

      <footer className="doortodoor-footer">

        © Agjencia Shtetërore e Kadastrës

      </footer>

    </div>

  );

}