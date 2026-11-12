import { useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import ZONES from "../doortodoor/data/zones.json";

import CALENDAR from "../doortodoor/data/calendar.json";

import "./PublicDashboard.css";

/* Helpers */

const normalize = (value = "") => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const field = (item, ...names) => {

  for (const name of names) {

    const value = item?.[name];

    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();

  }

  return "";

};

const getPershkrimi = (item) => {

  return field(

    item,

    "Statusi i matjes",

    "Statusi i Matjes",

    "statusi_i_matjes",

    "Përshkrimi",

    "Pershkrimi"

  ) || "—";

};

// Shfaq pronarin e pare; pronaret e tjere hapen vetem kur kerkohen.

const OwnerCell = ({ value }) => {
  const [expanded, setExpanded] = useState(false);
  const names = String(value ?? "")
    .split(/\r?\n|;/)
    .map((name) => name.trim())
    .filter(Boolean);

  if (!names.length) return <span className="owner-cell">—</span>;

  return (
    <div className="owner-cell">
      <div className="owner-primary">
        <span className="owner-first">{names[0]}</span>
        {names.length > 1 && (
          <button type="button" className="owner-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((previous) => !previous)}>
            {expanded ? "Shfaq më pak" : `+${names.length - 1} të tjerë`}
          </button>
        )}
      </div>
      {expanded && (
        <div className="owner-more">
          {names.slice(1).map((name, index) => <div key={index}>{name}</div>)}
        </div>
      )}
    </div>
  );
};

const parseDate = (value) => {

  if (!value || value === "-") return null;

  const match = String(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (!match) return null;

  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

  return Number.isNaN(date.getTime()) ? null : date;

};

const STATUS_OPTIONS = [

  { key: "approved", label: "Pajisur me vendim" },

  { key: "public", label: "Afishim publik" },

  { key: "missing", label: "Mungesë dokumentacioni" },

  { key: "noAccess", label: "I paaksesueshëm" },

  { key: "inProcess", label: "Në shqyrtim dokumentacioni" },

  { key: "other", label: "Tjetër" },

];

const getApplicationStatus = (item) => {

  const values = [field(item, "Kategoria", "kategoria", "category"), field(item, "Statusi", "status"), field(item, "Cilësimi", "Cilesimi")].map(normalize);

  const matches = (terms) => values.some((value) => terms.some((term) => value.includes(term)));

  if (matches(["pajisur me vendim", "me vendim", "vkm"])) return "approved";

  if (matches(["afishim publik", "ne afishim"])) return "public";

  if (matches(["mungese dokumentacioni", "mungon", "ska dosje", "s'ka dosje", "pa dosje"])) return "missing";

  if (matches(["paaksesueshem", "i paaksesueshem", "pa akses", "nuk ka qen ne objekt"])) return "noAccess";

  if (matches(["ne proces", "ne shqyrtim", "shqyrtim dokumentacioni", "pa matje"])) return "inProcess";

  return "other";

};

const getApplicationStatusLabel = (item) => {

  const raw = field(item, "Statusi", "status", "Kategoria", "kategoria", "category", "Cilësimi", "Cilesimi");

  return raw || STATUS_OPTIONS.find((s) => s.key === getApplicationStatus(item))?.label || "Tjetër";

};

const getCounts = (zone) => {

  const applications = Array.isArray(zone.applications) ? zone.applications : [];

  const counts = { total: applications.length };

  STATUS_OPTIONS.forEach(({ key }) => { counts[key] = applications.filter((item) => getApplicationStatus(item) === key).length; });

  counts.publicDisplay = counts.public;

  return counts;

};

const getZoneStatus = (zone, period = zone) => {

  if (Array.isArray(zone.applications) && zone.applications.length > 0) return "completed";

  const start = parseDate(period?.startDate);

  if (!start) return "planned";

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return today < start ? "planned" : "review";

};

const applicationSearchText = (item) => normalize([

  field(item, "Emër", "Emer", "emer", "emri"),

  field(item, "Atësi", "Atesi", "atesi"),

  field(item, "Mbiemër", "Mbiemer", "mbiemer", "mbiemri"),

  field(item, "Kategoria", "kategoria", "category"),

  field(item, "Statusi", "status"),

  field(item, "Cilësimi", "Cilesimi"),

  getPershkrimi(item),

  getApplicationStatusLabel(item), item.fshati, item.bashkia, item.zk,

].join(" "));

export default function PublicDashboard() {

  const navigate = useNavigate();

  const zoneRefs = useRef({});

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [showAllZonesByStatus, setShowAllZonesByStatus] = useState(false);

  const [selectedCalendar, setSelectedCalendar] = useState(null);

  const [selectedZone, setSelectedZone] = useState(null);

  const [listModal, setListModal] = useState(null);

  const [listSearch, setListSearch] = useState("");

  const [globalListModal, setGlobalListModal] = useState(null);

  const [globalListSearch, setGlobalListSearch] = useState("");

  const allApplications = useMemo(() => ZONES.flatMap((zone) =>

    (Array.isArray(zone.applications) ? zone.applications : []).map((item, index) => ({

      ...item,

      _rowId: `${zone.id}-${index}`,

      fshati: zone.fshati || "",

      bashkia: zone.bashkia || "",

      zk: zone.zk || "",

      dv: zone.dv || "",

    }))

  ), []);

  const totals = useMemo(() => {

    const result = { applications: 0, approved: 0, publicDisplay: 0, missing: 0, noAccess: 0, inProcess: 0, other: 0, completedZones: 0, reviewZones: 0, plannedZones: 0 };

    ZONES.forEach((zone) => {

      const counts = getCounts(zone);

      result.applications += counts.total;

      STATUS_OPTIONS.forEach(({ key }) => { result[key === "public" ? "publicDisplay" : key] += counts[key]; });

      const status = getZoneStatus(zone);

      if (status === "completed") result.completedZones++;

      else if (status === "review") result.reviewZones++;

      else result.plannedZones++;

    });

    return result;

  }, []);

const municipalityAgenda = useMemo(() => {

    const groups = new Map();

    CALENDAR.forEach((entry) => {

      const key = normalize(entry.bashkia);

      if (!key) return;

      if (!groups.has(key)) groups.set(key, { ...entry, locations: [], locationDates: {}, drejtoriteVendore: [], njesiteAdministrative: [] });

      const group = groups.get(key);

      group.locations.push(...(entry.locations || []));

      Object.assign(group.locationDates, entry.locationDates || {});

      const offices = Array.isArray(entry.drejtoriteVendore) ? entry.drejtoriteVendore : [entry.drejtoriteVendore].filter(Boolean);

      offices.forEach((office) => { if (office && !group.drejtoriteVendore.includes(office)) group.drejtoriteVendore.push(office); });

      if (entry.njesiaAdministrative && !group.njesiteAdministrative.includes(entry.njesiaAdministrative)) group.njesiteAdministrative.push(entry.njesiaAdministrative);

    });

    return [...groups.values()].map((group) => {

      const locations = [...new Set(group.locations)];

      const zoneNames = new Set(locations.map(normalize));

      const zones = ZONES.filter((zone) => normalize(zone.bashkia) === normalize(group.bashkia) && zoneNames.has(normalize(zone.fshati)));

      const startDates = [group.startDate, ...Object.values(group.locationDates).map((p) => p?.startDate)].map(parseDate).filter(Boolean);

      const endDates = [group.endDate, ...Object.values(group.locationDates).map((p) => p?.endDate)].map(parseDate).filter(Boolean);

      const start = startDates.length ? new Date(Math.min(...startDates.map(Number))) : null;

      const end = endDates.length ? new Date(Math.max(...endDates.map(Number))) : null;

      const today = new Date(); today.setHours(0, 0, 0, 0);

      const agendaStatus = !start || !end ? "waiting" : today < start ? "waiting" : today > end ? "completed" : "active";

      return { ...group, locations, zones, agendaStatus, canOpen: agendaStatus !== "waiting" };

    });

  }, []);

  const getZonePeriod = (zone) => {

    const calendar = municipalityAgenda.find((item) => normalize(item.bashkia) === normalize(zone.bashkia));

    const entry = Object.entries(calendar?.locationDates || {}).find(([name]) => normalize(name) === normalize(zone.fshati));

    const period = entry?.[1];

    return { startDate: period?.startDate || zone.startDate || calendar?.startDate || "-", endDate: period?.endDate || zone.endDate || calendar?.endDate || "-" };

  };

  const filteredZones = useMemo(() => {

    const source = showAllZonesByStatus ? ZONES : (selectedCalendar?.zones || []);

    return source.filter((zone) => statusFilter === "all" || getZoneStatus(zone, getZonePeriod(zone)) === statusFilter);

  }, [selectedCalendar, showAllZonesByStatus, statusFilter, municipalityAgenda]);

  const filteredListItems = useMemo(() => {

    if (!listModal) return [];

    const query = normalize(listSearch);

    return !query ? listModal.items : listModal.items.filter((item) => applicationSearchText({ ...item, fshati: listModal.zone?.fshati, zk: listModal.zone?.zk }).includes(query));

  }, [listModal, listSearch]);

  const filteredGlobalItems = useMemo(() => {

    if (!globalListModal) return [];

    const query = normalize(globalListSearch);

    return !query ? globalListModal.items : globalListModal.items.filter((item) => applicationSearchText(item).includes(query));

  }, [globalListModal, globalListSearch]);

  // Search only citizen names at the top, updating results while typing.

  const liveNameResults = useMemo(() => {

    const query = normalize(search);

    if (!query) return [];

    return allApplications.filter((item) => normalize([

      field(item, "Emër", "Emer", "emer", "emri"),

      field(item, "Mbiemër", "Mbiemer", "mbiemer", "mbiemri"),

    ].join(" ")).includes(query));

  }, [search, allApplications]);

  const openGlobalApplications = (category = "all", title = "Të gjitha banesat e evidentuara") => {

    const items = category === "all" ? allApplications : allApplications.filter((item) => getApplicationStatus(item) === category);

    setGlobalListSearch("");

    setGlobalListModal({ category, title, items });

  };

  const handleStatusCardClick = (status) => {

    const active = showAllZonesByStatus && statusFilter === status;

    setStatusFilter(active ? "all" : status);

    setShowAllZonesByStatus(!active);

    setSelectedCalendar(null);

    if (!active) requestAnimationFrame(() => document.getElementById("zones-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));

  };

  const handleAgendaClick = (item) => {

    if (!item.canOpen) return;

    setShowAllZonesByStatus(false);

    setSelectedCalendar(item);

    setStatusFilter("all");

    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("zones-list")?.scrollIntoView({ behavior: "smooth", block: "start" })));

  };

  const openApplicationsList = (zone, category, title) => {

    const items = (zone.applications || []).filter((item) => getApplicationStatus(item) === category);

    setSelectedZone(zone);

    setListSearch("");

    setListModal({ zone, category, title, items });

  };

  const closeListModal = () => {

    const zone = listModal?.zone;

    setListModal(null);

    setListSearch("");

    if (zone) setSelectedZone(zone);

  };

  const openMap = (zone) => {

    if (!zone) return;

    setSelectedZone(null);

    navigate(`/doortodoor?zone=${encodeURIComponent(normalize(zone.fshati))}&zk=${encodeURIComponent(zone.zk || "")}`);

  };

  return (

    <div className="public-dashboard">

      <style>{`

        @media (min-width: 769px) {

          .public-dashboard .zones-table { overflow-x: auto; }

          .public-dashboard .zones-table .zones-table-head,

          .public-dashboard .zones-table .zone-row {

            display: grid; grid-template-columns: minmax(65px,.65fr) minmax(120px,1.2fr) minmax(90px,.9fr) minmax(160px,1.5fr) minmax(120px,1.1fr) minmax(190px,1.7fr) 28px;

            align-items: center; min-width: 890px; column-gap: 10px;

          }

          .public-dashboard .zones-table .zone-cell { min-width: 0; overflow-wrap: anywhere; }

        }

        .public-dashboard .application-kpis > button { font: inherit; color: inherit; text-align: inherit; cursor: pointer; border: 0; transition: transform .2s, box-shadow .2s; }

        .public-dashboard .application-kpis > button:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(15,23,42,.12); }

        .public-dashboard .application-kpis > button:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }

        .public-dashboard .citizen-results { margin-top: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; max-height: 330px; overflow-y: auto; box-shadow: 0 8px 24px rgba(15,23,42,.08); }

        .public-dashboard .citizen-result { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #fff; border: 0; border-bottom: 1px solid #eef2f7; text-align: left; cursor: pointer; font: inherit; }

        .public-dashboard .citizen-result:hover { background: #f8fafc; }

        .public-dashboard .citizen-result strong { display: block; color: #0f172a; }

        .public-dashboard .citizen-result small { display: block; margin-top: 3px; color: #64748b; }

        .public-dashboard .citizen-result .application-status { flex-shrink: 0; }

        .public-dashboard .citizen-results-footer { width: 100%; padding: 12px; border: 0; background: #f1f5f9; color: #1d4ed8; font: inherit; font-weight: 700; cursor: pointer; }

        .public-dashboard .applications-modal-wide { width: min(1440px, 98vw); max-width: 1440px; max-height: 92dvh; overflow-y: auto; }

      .public-dashboard .applications-modal .applications-list { overflow-x: auto; border-radius: 12px; }

      .public-dashboard .applications-modal .applications-list-head,

      .public-dashboard .applications-modal .applications-list-row {

        display: grid; align-items: start; gap: 12px; box-sizing: border-box;

        height: auto; min-height: 58px; padding: 14px 16px;

      }

      .public-dashboard .applications-modal-wide .applications-list-head,

      .public-dashboard .applications-modal-wide .applications-list-row {

        grid-template-columns: minmax(180px, 1.7fr) minmax(100px, .9fr) minmax(130px, 1.1fr) minmax(95px, .85fr) 65px minmax(170px, 1.45fr) minmax(180px, 1.65fr);

        min-width: 1050px;

      }

      .public-dashboard .applications-modal:not(.applications-modal-wide) .applications-list-head,

      .public-dashboard .applications-modal:not(.applications-modal-wide) .applications-list-row {

        grid-template-columns: minmax(180px, 1.6fr) minmax(100px, 1fr) minmax(130px, 1.1fr) minmax(170px, 1.5fr) minmax(180px, 1.6fr);

        min-width: 800px;

      }

      .public-dashboard .applications-modal .applications-list-row > span,

      .public-dashboard .applications-modal .applications-list-head > span {

        min-width: 0; overflow-wrap: anywhere; white-space: normal; line-height: 1.5;

      }

      .public-dashboard .applications-modal .applications-list-row .application-status {

        display: inline-block; width: fit-content; max-width: 100%; white-space: normal;

        overflow-wrap: anywhere; line-height: 1.4; text-align: left;

      }

      .public-dashboard .applications-modal .applications-list-row > span:first-child { font-weight: 600; }

      @media (max-width:768px) { .public-dashboard .citizen-result { flex-wrap: wrap; } .public-dashboard .applications-modal-wide { width: 96vw; max-height: 90dvh; } }

      /* Tabelat kompakte: pa numer, pronare te shumte te palosur */

      .public-dashboard .applications-modal .applications-list.compact-app-table {

        width: 100%; max-height: 55vh; overflow-y: auto; overflow-x: auto;

        border: 1px solid #e2e8f0; border-radius: 12px;

      }

      .public-dashboard .applications-modal .compact-app-table .applications-list-head,

      .public-dashboard .applications-modal .compact-app-table .applications-list-row {

        display: grid; width: 100%; min-width: 0; box-sizing: border-box;

        align-items: start; gap: 10px; height: auto; min-height: 46px;

        padding: 9px 12px;

      }

      .public-dashboard .applications-modal-wide .compact-app-table .applications-list-head,

      .public-dashboard .applications-modal-wide .compact-app-table .applications-list-row {

        grid-template-columns: minmax(145px,1.5fr) minmax(100px,.85fr) minmax(115px,1fr) minmax(95px,.8fr) 55px minmax(160px,1.4fr) minmax(160px,1.35fr) minmax(180px,1.6fr);

      }

      .public-dashboard .applications-modal:not(.applications-modal-wide) .compact-app-table .applications-list-head,

      .public-dashboard .applications-modal:not(.applications-modal-wide) .compact-app-table .applications-list-row {

        grid-template-columns: minmax(160px,1.5fr) minmax(110px,1fr) minmax(130px,1fr) minmax(170px,1.5fr) minmax(170px,1.4fr) minmax(180px,1.6fr);

      }

      .public-dashboard .compact-app-table .applications-list-row > *,

      .public-dashboard .compact-app-table .applications-list-head > * {

        min-width: 0; overflow-wrap: anywhere; white-space: normal;

      }

      .public-dashboard .compact-app-table .owner-cell { display: block; line-height: 1.35; }

      .public-dashboard .compact-app-table .owner-details summary {

        cursor: pointer; list-style: none; display: flex; flex-wrap: wrap;

        align-items: center; gap: 5px; line-height: 1.35;

      }

      .public-dashboard .compact-app-table .owner-details summary::-webkit-details-marker { display: none; }

      .public-dashboard .compact-app-table .owner-details summary small {

        display: inline-block; color: #1d4ed8; font-size: 11px; font-weight: 700;

        background: #eff6ff; border-radius: 20px; padding: 2px 6px; white-space: nowrap;

      }

      .public-dashboard .compact-app-table .owner-more { padding-top: 6px; margin-top: 6px; border-top: 1px solid #e2e8f0; line-height: 1.5; }

      .public-dashboard .compact-app-table .owner-more > div + div { margin-top: 4px; }

      .public-dashboard .compact-app-table .application-status { font-size: 11px; padding: 5px 8px; }

      .public-dashboard .compact-app-table .measurement-description { color: #334155; font-size: 12px; line-height: 1.4; }

      @media (max-width: 900px) {

        .public-dashboard .applications-modal .applications-list.compact-app-table { overflow-x: auto; }

        .public-dashboard .applications-modal-wide .compact-app-table .applications-list-head,

        .public-dashboard .applications-modal-wide .compact-app-table .applications-list-row { min-width: 1150px; }

        .public-dashboard .applications-modal:not(.applications-modal-wide) .compact-app-table .applications-list-head,

        .public-dashboard .applications-modal:not(.applications-modal-wide) .compact-app-table .applications-list-row { min-width: 850px; }

      }

  
      /* Rreshtat zgjerohen kur hapen emrat e tjere */
      .public-dashboard .compact-app-table .applications-list-row {
        align-items: start !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        font-size: 13px;
        line-height: 1.5;
      }
      .public-dashboard .compact-app-table .applications-list-row > * {
        min-width: 0;
        max-height: none !important;
        overflow: visible !important;
        font-size: 13px;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .public-dashboard .compact-app-table .owner-cell {
        display: block;
        width: 100%;
        max-height: none !important;
        overflow: visible !important;
        line-height: 1.5;
      }
      .public-dashboard .compact-app-table .owner-primary {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
      }
      .public-dashboard .compact-app-table .owner-first { overflow-wrap: anywhere; }
      .public-dashboard .compact-app-table .owner-toggle {
        border: 0;
        border-radius: 20px;
        background: #e8f0ff;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.4;
        padding: 3px 7px;
        cursor: pointer;
      }
      .public-dashboard .compact-app-table .owner-more {
        display: block;
        position: static;
        max-height: none !important;
        overflow: visible !important;
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid #e2e8f0;
        font-size: 13px;
      }
      .public-dashboard .compact-app-table .application-category {
        font-size: 13px;
        line-height: 1.5;
        color: #334155;
      }
      .public-dashboard .applications-modal-wide .compact-app-table .applications-list-head,
      .public-dashboard .applications-modal-wide .compact-app-table .applications-list-row {
        grid-template-columns: minmax(145px,1.5fr) minmax(100px,.85fr) minmax(115px,1fr) minmax(95px,.8fr) 55px minmax(160px,1.4fr) minmax(160px,1.35fr) minmax(180px,1.6fr);
        min-width: 1150px;
      }
      .public-dashboard .applications-modal:not(.applications-modal-wide) .compact-app-table .applications-list-head,
      .public-dashboard .applications-modal:not(.applications-modal-wide) .compact-app-table .applications-list-row {
        grid-template-columns: minmax(160px,1.5fr) minmax(110px,1fr) minmax(130px,1fr) minmax(170px,1.5fr) minmax(170px,1.4fr) minmax(180px,1.6fr);
        min-width: 850px;
      }
    `}</style>

      <header className="dashboard-header">

        <div className="dashboard-header-main">

          <h1>Aksioni Derë më Derë</h1>

          <p>Platforma e Evidentimit në Terren</p>

        </div>

        <img src={`${import.meta.env.BASE_URL}images/logo_ashk_2.png`} alt="Agjencia Shtetërore e Kadastrës" className="doortodoor-logo-img" style={{ width: 110, height: "auto" }} />

      </header>

      <main className="dashboard-content">

        <section className="top-search">

          <div className="top-search-copy">

            <h2>Gjeni qytetarin</h2>

            <p>Kërkoni sipas emrit ose mbiemrit. Rezultatet shfaqen automatikisht gjatë shkrimit.</p>

          </div>

          <div className="main-search-controls">

            <div className="main-search-input">

              <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>⌕</span>

              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Shkruani emrin ose mbiemrin..." aria-label="Kërko qytetarin" autoComplete="off" />

              {search && <button type="button" onClick={() => setSearch("")} aria-label="Pastro kërkimin">×</button>}

            </div>

            {normalize(search) && (

              <div className="citizen-results" role="region" aria-label="Rezultatet e kërkimit">

                {liveNameResults.slice(0, 20).map((item) => (

                  <button type="button" className="citizen-result" key={item._rowId} onClick={() => {

                    setGlobalListSearch(search);

                    setGlobalListModal({ category: "all", title: "Rezultatet e kërkimit të qytetarëve", items: allApplications });

                  }}>

                    <span>

                      <strong>{field(item, "Emër", "Emer", "emer", "emri") || "—"} {field(item, "Mbiemër", "Mbiemer", "mbiemer", "mbiemri") || "—"}</strong>

                      <small>{item.fshati || "—"} · ZK {item.zk || "—"}</small>

                    </span>

                    <span className={`application-status ${getApplicationStatus(item)}`}>{getApplicationStatusLabel(item)}</span>

                  </button>

                ))}

                {liveNameResults.length === 0 && <div className="applications-empty">Nuk u gjet asnjë qytetar.</div>}

                {liveNameResults.length > 20 && <button type="button" className="citizen-results-footer" onClick={() => { setGlobalListSearch(search); setGlobalListModal({ category: "all", title: "Rezultatet e kërkimit të qytetarëve", items: allApplications }); }}>Shiko të gjitha {liveNameResults.length} rezultatet</button>}

              </div>

            )}

          </div>

        </section>

        <section className="main-kpis">

          <button type="button" className={`main-kpi completed ${showAllZonesByStatus && statusFilter === "completed" ? "active" : ""}`} onClick={() => handleStatusCardClick("completed")}>

            <div><span>Zona të përfunduara</span><small>Proces i përfunduar</small></div><strong>{totals.completedZones}</strong>

          </button>

          <button type="button" className={`main-kpi review ${showAllZonesByStatus && statusFilter === "review" ? "active" : ""}`} onClick={() => handleStatusCardClick("review")}>

            <div><span>Zona në shqyrtim</span><small>Proces në vijim</small></div><strong>{totals.reviewZones}</strong>

          </button>

          <button type="button" className={`main-kpi total ${showAllZonesByStatus && statusFilter === "all" ? "active" : ""}`} onClick={() => handleStatusCardClick("all")}>

            <div><span>Zona gjithsej</span><small>Zona kadastrale</small></div><strong>{ZONES.length}</strong>

          </button>

        </section>

        <section className="application-kpis">

          <div

            className="total"

            role="button"

            tabIndex={0}

            onClick={() =>

              openGlobalApplications("all", "Të gjitha banesat e evidentuara")

            }

            onKeyDown={(e) => {

              if (e.key === "Enter" || e.key === " ") {

                e.preventDefault();

                openGlobalApplications("all", "Të gjitha banesat e evidentuara");

              }

            }}

          >

            <strong>{totals.applications}</strong>

            <span>Banesa të evidentuara</span>

          </div>

          {STATUS_OPTIONS.map(({ key, label }) => (

            <div

              key={key}

              className={key}

              role="button"

              tabIndex={0}

              onClick={() => openGlobalApplications(key, label)}

              onKeyDown={(e) => {

                if (e.key === "Enter" || e.key === " ") {

                  e.preventDefault();

                  openGlobalApplications(key, label);

                }

              }}

            >

              <strong>

                {totals[key === "public" ? "publicDisplay" : key]}

              </strong>

              <span>{label}</span>

            </div>

          ))}

        </section>

        <section className="agenda-section">

          <div className="agenda-header">

            <div><span className="eyebrow">Bashkitë dhe periudhat e evidentimit</span><h2>Kalendar i evidentimit në terren</h2></div>

            {selectedCalendar && <button type="button" className="agenda-reset" onClick={() => setSelectedCalendar(null)}>Mbyll listën</button>}

          </div>

          <div className="agenda-board">

            <div className="agenda-table-head"><span>Bashkia</span><span>Periudha e evidentimit</span><span>Statusi</span><span>Zona</span><span /></div>

            {municipalityAgenda.map((item) => (

              <button type="button" key={item.id ?? normalize(item.bashkia)} disabled={!item.canOpen} className={`agenda-row ${selectedCalendar?.bashkia === item.bashkia ? "selected" : ""} ${!item.canOpen ? "locked" : ""}`} onClick={() => handleAgendaClick(item)}>

                <div className="agenda-bashkia">

                  <small>BASHKIA</small><strong>{item.bashkia}</strong>

                  {item.njesiteAdministrative.length > 0 && <span>Njësia Administrative: {item.njesiteAdministrative.join(" · ")}</span>}

                  <span>DV {item.drejtoriteVendore.join(" · ")}</span>

                </div>

                <div className="agenda-period">

                  <div className="agenda-date"><small>FILLIMI</small><strong>{item.startDate || "—"}</strong></div>

                  <div className="agenda-line"><i /><span /><i /></div>

                  <div className="agenda-date agenda-date-end"><small>PËRFUNDIMI</small><strong>{item.endDate || "—"}</strong></div>

                </div>

                <div><span className={`agenda-status ${item.agendaStatus}`}>{item.agendaStatus === "completed" ? "Përfunduar Terreni" : item.agendaStatus === "active" ? "Në terren" : "Në pritje"}</span></div>

                <div className="agenda-count"><strong>{item.zones.length}</strong><span>ZK</span></div>

                <span className="agenda-arrow">{item.canOpen ? "↓" : "🔒"}</span>

              </button>

            ))}

          </div>

        </section>

        {(selectedCalendar || showAllZonesByStatus) && (

          <section className="zones-section" id="zones-list">

            <div className="zones-heading">

              <div><span className="eyebrow">ZONAT KADASTRALE</span><h2>{showAllZonesByStatus ? statusFilter === "completed" ? "Zona të përfunduara" : statusFilter === "review" ? "Zona në shqyrtim" : "Të gjitha zonat" : `Bashkia ${selectedCalendar.bashkia}`}</h2></div>

              <span>{filteredZones.length} {filteredZones.length === 1 ? "zonë" : "zona"}</span>

            </div>

            <div className="zones-table">

              <div className="zones-table-head"><span>ZK</span><span>Fshati</span><span>Bashkia</span><span>Njësia Administrative</span><span>Statusi</span><span>Afati</span><span /></div>

              {filteredZones.map((zone) => {

                const period = getZonePeriod(zone);

                const status = getZoneStatus(zone, period);

                const statusLabel = status === "completed" ? "Përfunduar Terreni" : status === "review" ? "Në shqyrtim" : "Planifikuar";

                return (

                  <button type="button" className={`zone-row ${status === "completed" ? "clickable" : "disabled"} zone-mobile-${status}`} key={zone.id} ref={(el) => { zoneRefs.current[String(zone.id)] = el; }} disabled={status !== "completed"} onClick={() => setSelectedZone(zone)}>

                    <div className="zone-cell"><small>ZK</small><strong>{zone.zk || "—"}</strong></div>

                    <div className="zone-cell"><small>Fshati</small><span>{zone.fshati}</span></div>

                    <div className="zone-cell"><small>Bashkia</small><span>{zone.bashkia}</span></div>

                    <div className="zone-cell"><small>Njësia Administrative</small><span>{zone.njesiaAdministrative || (normalize(zone.bashkia) === "finiq" && ["finiq", "vrion", "karahaxhe", "bregas", "clirim", "buronje"].includes(normalize(zone.fshati)) ? "Finiq" : "—")}</span></div>

                    <div className="zone-cell"><small>Statusi</small><span className={`zone-status ${status}`}>{statusLabel}</span></div>

                    <div className="zone-cell"><small>Afati</small><span>{period.startDate} — {period.endDate}</span></div>

                    <span className="zone-arrow">→</span>

                    <div className="zone-mobile-card" aria-hidden="true">

                      <div className="zone-mobile-main"><div className="zone-mobile-name"><strong>ZK {zone.zk || "—"}</strong><span>{zone.fshati || "—"}</span></div><span className={`zone-mobile-status ${status}`}>{statusLabel}</span></div>

                      <div className="zone-mobile-bottom"><div className="zone-mobile-period"><small>PERIUDHA E EVIDENTIMIT</small><span>{period.startDate} — {period.endDate}</span></div><span className="zone-mobile-arrow">→</span></div>

                    </div>

                  </button>

                );

              })}

              {filteredZones.length === 0 && <div className="zones-empty">Nuk u gjet asnjë zonë për filtrin e zgjedhur.</div>}

            </div>

          </section>

        )}

      </main>

      {/* Existing cadastral zone modal */}

      {selectedZone && (

        <div className="modal-overlay zone-modal-overlay" onMouseDown={() => setSelectedZone(null)}>

          <div className="zone-modal" onMouseDown={(e) => e.stopPropagation()}>

            <button type="button" className="modal-close" onClick={() => setSelectedZone(null)}>×</button>

            <span className="eyebrow">ZONA KADASTRALE</span>

            <h2>ZK {selectedZone.zk || "—"}</h2>

            <p className="zone-location">{selectedZone.fshati} · {selectedZone.bashkia} · {selectedZone.dv}</p>

            <div className="zone-modal-summary">

              <div><span>Periudha e evidentimit</span><strong>{getZonePeriod(selectedZone).startDate} — {getZonePeriod(selectedZone).endDate}</strong></div>

              <div><span>Evidentime</span><strong>{getCounts(selectedZone).total}</strong></div>

            </div>

            <div className="zone-options">

              {STATUS_OPTIONS.map(({ key, label }) => (

                <button type="button" key={key} className={`zone-option ${key}`} onClick={() => openApplicationsList(selectedZone, key, label)}>

                  <span className="option-dot" /><div><strong>{label}</strong><small>Shiko listën</small></div><b>{getCounts(selectedZone)[key]}</b><i>→</i>

                </button>

              ))}

              <button type="button" className="zone-option map" onClick={() => openMap(selectedZone)}><span className="option-dot" /><div><strong>Shiko të dhënat në hartë</strong><small>{selectedZone.fshati}</small></div><i>→</i></button>

            </div>

          </div>

        </div>

      )}

      {/* Existing zone application list modal - kept separate */}

      {listModal && (

        <div className="modal-overlay" onMouseDown={closeListModal}>

          <div className="applications-modal" onMouseDown={(e) => e.stopPropagation()}>

            <button type="button" className="modal-close" onClick={closeListModal}>×</button>

            <div className="applications-modal-title"><span className="eyebrow">ZK {listModal.zone.zk || "—"} · {listModal.zone.fshati}</span><h2>{listModal.title}</h2><p>Kërkoni sipas emrit, atësisë, mbiemrit ose statusit.</p></div>

            <div className="nid-search"><span>⌕</span><input type="text" value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Kërko në listë..." autoFocus autoComplete="off" />{listSearch && <button type="button" onClick={() => setListSearch("")}>×</button>}</div>

            <div className="applications-meta"><span><strong>{filteredListItems.length}</strong> {filteredListItems.length === 1 ? "rezultat" : "rezultate"}</span><span>{getZonePeriod(listModal.zone).startDate} — {getZonePeriod(listModal.zone).endDate}</span></div>

            <div className="applications-list compact-app-table">

              <div className="applications-list-head"><span>Emër</span><span>Atësi</span><span>Mbiemër</span><span>Statusi</span><span>Kategoria</span><span>Përshkrimi</span></div>

              {filteredListItems.map((item, index) => (

                <div className="applications-list-row" key={item.id || index}>

                  <OwnerCell value={field(item, "Emër", "Emer", "emer", "emri")} />

                  <OwnerCell value={field(item, "Atësi", "Atesi", "atesi")} />

                  <OwnerCell value={field(item, "Mbiemër", "Mbiemer", "mbiemer", "mbiemri")} />

                  <span className={`application-status ${getApplicationStatus(item)}`}>{field(item, "Cilësimi", "Cilesimi") || getApplicationStatusLabel(item)}</span>
                <span className="application-category">{field(item, "Kategoria", "kategoria", "category") || "—"}</span>

                  <span className="measurement-description">{getPershkrimi(item)}</span>

                </div>

              ))}

              {filteredListItems.length === 0 && <div className="applications-empty"><strong>Nuk u gjet aplikim</strong><span>Provoni një kërkim tjetër.</span></div>}

            </div>

          </div>

        </div>

      )}

      {/* New global list modal, opened by all application KPI cards */}

      {globalListModal && (

        <div className="modal-overlay" onMouseDown={() => setGlobalListModal(null)}>

          <div className="applications-modal applications-modal-wide" onMouseDown={(e) => e.stopPropagation()}>

            <button type="button" className="modal-close" onClick={() => setGlobalListModal(null)} aria-label="Mbyll">×</button>

            <div className="applications-modal-title"><span className="eyebrow">EVIDENTIMI NË TERREN</span><h2>{globalListModal.title}</h2><p>Kërkoni sipas emrit, mbiemrit, atësisë, statusit, kategorisë ose fshatit.</p></div>

            <div className="nid-search"><span>⌕</span><input type="text" value={globalListSearch} onChange={(e) => setGlobalListSearch(e.target.value)} placeholder="Kërko emër, mbiemër, status, fshat..." autoFocus autoComplete="off" />{globalListSearch && <button type="button" onClick={() => setGlobalListSearch("")}>×</button>}</div>

            <div className="applications-meta"><span><strong>{filteredGlobalItems.length}</strong> {filteredGlobalItems.length === 1 ? "rezultat" : "rezultate"}</span></div>

            <div className="applications-list compact-app-table">

              <div className="applications-list-head"><span>Emër</span><span>Atësi</span><span>Mbiemër</span><span>Fshati</span><span>ZK</span><span>Statusi / Cilësimi</span><span>Kategoria</span><span>Përshkrimi</span></div>

              {filteredGlobalItems.map((item, index) => (

                <div className="applications-list-row" key={item._rowId || index}>

                  <OwnerCell value={field(item, "Emër", "Emer", "emer", "emri")} />

                  <OwnerCell value={field(item, "Atësi", "Atesi", "atesi")} />

                  <OwnerCell value={field(item, "Mbiemër", "Mbiemer", "mbiemer", "mbiemri")} />

                  <span>{item.fshati || "—"}</span><span>{item.zk || "—"}</span>

                  <span className={`application-status ${getApplicationStatus(item)}`}>{field(item, "Cilësimi", "Cilesimi") || getApplicationStatusLabel(item)}</span>
                <span className="application-category">{field(item, "Kategoria", "kategoria", "category") || "—"}</span>

                <span className="measurement-description">{getPershkrimi(item)}</span>

                </div>

              ))}
              {filteredGlobalItems.length === 0 && <div className="applications-empty"><strong>Nuk u gjet asnjë banesë</strong><span>Provoni një kërkim tjetër.</span></div>}

            </div>

          </div>

        </div>

      )}

    </div>

  );

}