import { useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import ZONES from "../doortodoor/data/zones.json";

import CALENDAR from "../doortodoor/data/calendar.json";

import "./PublicDashboard.css";

/* =========================================================

   HELPERS

   ========================================================= */

const normalize = (value = "") =>

  value

    .toString()

    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .trim();

const createZoneSlug = (name = "") =>

  normalize(name)

    .replace(/\s+/g, "-")

    .replace(/[^a-z0-9-]/g, "");

const parseDate = (value) => {

  if (!value) return new Date(0);

  const [day, month, year] = value.split(".");

  return new Date(

    Number(year),

    Number(month) - 1,

    Number(day)

  );

};

const getZoneStatus = (zone) => {

  if (Array.isArray(zone.applications) && zone.applications.length > 0) return "completed";

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  if (!zone.startDate || !zone.endDate) return "planned";

  const start = parseDate(zone.startDate);

  const end = parseDate(zone.endDate);

  if (today < start) return "planned";

  return "review";

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

  const category = normalize(item.Kategoria || item.kategoria || item.category || "");

  const status = normalize(item.Statusi || item.status || "");

  const value = category || status;



  if (value.includes("pajisur me vendim") || value.includes("me vendim") || value.includes("vkm")) return "approved";

  if (value.includes("afishim publik") || value.includes("ne afishim")) return "public";

  if (value.includes("mungese dokumentacioni") || value.includes("mungon") || value.includes("ska dosje") || value.includes("s'ka dosje") || value.includes("pa dosje")) return "missing";

  if (value.includes("paaksesueshem") || value.includes("pa akses") || value.includes("nuk ka qen ne objekt")) return "noAccess";

  if (value.includes("ne proces") || value.includes("pa matje")) return "inProcess";

  return "other";

};



const getCounts = (zone) => {

  const applications = Array.isArray(zone.applications) ? zone.applications : [];

  const counts = { total: applications.length };

  STATUS_OPTIONS.forEach(({ key }) => {

    counts[key] = applications.filter((item) => getApplicationStatus(item) === key).length;

  });

  counts.publicDisplay = counts.public;

  return counts;

};



/* =========================================================

   COMPONENT

   ========================================================= */

export default function PublicDashboard() {

  const navigate = useNavigate();

  const zoneRefs = useRef({});

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =

    useState("all");

  /*

    Ruajmë rreshtin e zgjedhur nga calendar.json,

    jo vetëm emrin e bashkisë.

  */

  const [

    selectedCalendar,

    setSelectedCalendar,

  ] = useState(null);

  const [

    selectedZone,

    setSelectedZone,

  ] = useState(null);

  const [

    listModal,

    setListModal,

  ] = useState(null);

  const [

    listSearch,

    setListSearch,

  ] = useState("");

  /* ======================================================

     GLOBAL TOTALS

     ====================================================== */

   const searchZone = () => {

    const query = normalize(search);

    if (!query) return 0;

    const zone = ZONES.find((z) => normalize(z.zk) === query) ||

      ZONES.find((z) => normalize(z.fshati) === query);

    if (!zone) return 0;

    const calendar = municipalityAgenda.find((c) => c.zones.some((z) => z.id === zone.id));

    if (calendar) setSelectedCalendar(calendar);

    setStatusFilter("all");

    if (getZoneStatus(zone) === "completed") {

      setSelectedZone(zone);

      return 1;

    }

    requestAnimationFrame(() => requestAnimationFrame(() => {

      const el = zoneRefs.current[String(zone.id)];

      el?.scrollIntoView({ behavior: "smooth", block: "center" });

    }));

    return 1;

  };

 const totals = useMemo(() => {

    const result = {

      applications: 0,

      approved: 0,

      publicDisplay: 0,

      missing: 0,
    noAccess: 0,
    inProcess: 0,
    other: 0,

      completedZones: 0,

      reviewZones: 0,

      plannedZones: 0,

    };

    ZONES.forEach((zone) => {

      const counts = getCounts(zone);

      result.applications += counts.total;

      result.approved += counts.approved;

      result.publicDisplay +=

        counts.publicDisplay;

      result.missing += counts.missing;

    result.noAccess += counts.noAccess;

    result.inProcess += counts.inProcess;

    result.other += counts.other;

      const zoneStatus = getZoneStatus(zone);

      if (

        zoneStatus === "completed"

      ) {

        result.completedZones += 1;

      }

      if (

        zoneStatus === "review"

      ) {

        result.reviewZones += 1;

      }

      if (

        zoneStatus === "planned"

      ) {

        result.plannedZones += 1;

      }

    });

    return result;

  }, []);

  const getAgendaStatus = (item) => {

    // Nuk ka periudhë të përcaktuar

    if (!item.startDate || !item.endDate) {

      return "waiting";

    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const start = parseDate(item.startDate);

    const end = parseDate(item.endDate);

    start.setHours(0, 0, 0, 0);

    end.setHours(23, 59, 59, 999);

    if (today < start) {

      return "waiting";

    }

    if (today > end) {

      return "completed";

    }

    return "active";

  };

  /* ======================================================

     KALENDAR NGA calendar.json

     Çdo rekord i calendar.json qëndron më vete.

     Nuk grupojmë më sipas bashkisë.

     ====================================================== */

  const municipalityAgenda = useMemo(() => {

    return [...CALENDAR].map((calendarItem) => {

      const locations =

        calendarItem.locations || [];

      const zones = ZONES.filter((zone) =>

        locations.some(

          (location) =>

            normalize(location) ===

            normalize(zone.fshati)

        )

      );

      return {

        ...calendarItem,

        zones,

        agendaStatus:

          calendarItem.status || "waiting",

        canOpen:

          calendarItem.status === "active" ||

          calendarItem.status === "completed",

      };

    });

  }, []);

  /* ======================================================

     FILTER ZONES

     ====================================================== */

  const filteredZones = useMemo(() => {

    if (!selectedCalendar) {

      return [];

    }

    const q = normalize(search);

    const locations =

      selectedCalendar.locations || [];

    return ZONES.filter((zone) => {

      const belongsToCalendar =

        locations.some(

          (location) =>

            normalize(location) ===

            normalize(zone.fshati)

        );

      const searchText = normalize(`

        ${zone.zk || ""}

        ${zone.fshati || ""}

        ${zone.bashkia || ""}

        ${zone.dv || ""}

        ${zone.startDate || ""}

        ${zone.endDate || ""}

      `);

      const matchesSearch =

        !q ||

        searchText.includes(q);

      const zoneStatus = getZoneStatus(zone);

      const matchesStatus =

        statusFilter === "all" ||

        zoneStatus === statusFilter;

      return (

        belongsToCalendar &&

        matchesSearch &&

        matchesStatus

      );

    });

  }, [

    selectedCalendar,

    search,

    statusFilter,

  ]);

  /* ======================================================

     SEARCH LISTA

     ====================================================== */

  const filteredListItems =

    useMemo(() => {

      if (!listModal) {

        return [];

      }

      const q =

        normalize(listSearch);

      if (!q) {

        return listModal.items;

      }

      return listModal.items.filter(

        (item) =>

          normalize(`${item["Emër"] || ""} ${item["Atësi"] || ""} ${item["Mbiemër"] || ""} ${item.Statusi || item.status || ""} ${item.Kategoria || item.kategoria || ""}`).includes(q)

      );

    }, [

      listModal,

      listSearch,

    ]);

  /* ======================================================

     CLICK KALENDAR

     ====================================================== */

  const handleAgendaClick = (item) => {

    if (!item.canOpen) {

      return;

    }

    setSelectedCalendar(item);

    setSearch("");

    setStatusFilter("all");

    setTimeout(() => {

      document

        .getElementById(

          "zones-list"

        )

        ?.scrollIntoView({

          behavior: "smooth",

          block: "start",

        });

    }, 80);

  };

  /* ======================================================

     OPEN APPLICATION LIST

     ====================================================== */

  const openApplicationsList = (

    zone,

    category,

    title

  ) => {

    const applications =

      zone.applications || [];

    const items =

      applications.filter(

        (item) =>

          getApplicationStatus(item) === category

      );

    setSelectedZone(zone);

    setListSearch("");

    setListModal({

      zone,

      category,

      title,

      items,

    });

  };

  /* ======================================================

     CLOSE LIST MODAL

     ====================================================== */

  const closeListModal = () => {

    const zoneToRestore =

      listModal?.zone;

    setListModal(null);

    setListSearch("");

    if (zoneToRestore) {

      setSelectedZone(

        zoneToRestore

      );

    }

  };

  /* ======================================================

     OPEN MAP

     ====================================================== */

const openMap = (zone) => {

  if (!zone) return;

  setSelectedZone(null);

  navigate(

    `/doortodoor?zone=${encodeURIComponent(

      normalize(zone.fshati)

    )}&zk=${encodeURIComponent(zone.zk || "")}`

  );

};

  /* ======================================================

     JSX

     ====================================================== */

  return (

    <div className="public-dashboard">

      {/* =================================================

          HEADER

          \\\\================================================= */}

      <header className="dashboard-header">

        <div className="dashboard-header-main">

          <h1>

            Aksioni  Derë më Derë

          </h1>

          <p>

            Platforma e Evidentimit

            në Terren

          </p>

        </div>

        <img

          src={`${import.meta.env.BASE_URL}images/logo_ashk_2.png`}

          alt="Agjencia Shtetërore e Kadastrës"

          className="doortodoor-logo-img"

          style={{

            width: "110px",

            height: "auto",

          }}

        />

      </header>

      <main className="dashboard-content">

     { /*   =================================================

            SEARCH

          ================================================= */}

        <>

          <section className="top-search">

            <div className="top-search-copy">

              <span className="eyebrow">

                INFORMACION PUBLIK

              </span>

              <h2>

                Gjeni zonën kadastrale

              </h2>

              <p>

                Kërkoni sipas ZK,

                fshatit, bashkisë ose

                drejtorisë vendore.

              </p>

            </div>

            <div className="main-search-controls">

              <div className="main-search-input">

                <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>⌕</span>

                <input

                  type="text"

                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchZone(); } }}

                  value={search}

                  onChange={(e) =>

                    setSearch(

                      e.target.value

                    )

                  }

                  placeholder="Kërko ZK, fshat, bashki..."

                />

                <button type="button" onClick={searchZone} aria-label="Kërko zonën" title="Kërko" style={{ fontSize: 26, lineHeight: 1, minWidth: 40, minHeight: 40, cursor: "pointer" }}>⌕</button>

              {search && (

                  <button

                    type="button"

                    onClick={() =>

                      setSearch("")

                    }

                    aria-label="Pastro kërkimin"

                    style={{ fontSize: 26, lineHeight: 1, minWidth: 40, minHeight: 40, cursor: "pointer" }}

                  >

                    ×

                  </button>

                )}

              </div>

              <select

                value={statusFilter}

                onChange={(e) =>

                  setStatusFilter(

                    e.target.value

                  )

                }

              >

                <option value="all">

                  Të gjitha zonat

                </option>

                <option value="completed">

                  Të përfunduara

                </option>

                <option value="review">

                  Në shqyrtim

                </option>

                <option value="planned">

                  Të planifikuara

                </option>

              </select>

            </div>

          </section>

          <section className="main-kpis">

            <button

              type="button"

              className={`main-kpi completed ${statusFilter ===

                  "completed"

                  ? "active"

                  : ""

                }`}

              onClick={() =>

                setStatusFilter(

                  statusFilter ===

                    "completed"

                    ? "all"

                    : "completed"

                )

              }

            >

              <div>

                <span>

                  Zona të përfunduara

                </span>

                <small>

                  Proces i përfunduar

                </small>

              </div>

              <strong>

                {totals.completedZones}

              </strong>

            </button>

            <button

              type="button"

              className={`main-kpi review ${statusFilter ===

                  "review"

                  ? "active"

                  : ""

                }`}

              onClick={() =>

                setStatusFilter(

                  statusFilter ===

                    "review"

                    ? "all"

                    : "review"

                )

              }

            >

              <div>

                <span>

                  Zona në shqyrtim

                </span>

                <small>

                  Proces në vijim

                </small>

              </div>

              <strong>

                {totals.reviewZones}

              </strong>

            </button>

            <div className="main-kpi total">

              <div>

                <span>

                  Zona gjithsej 

                </span>

                <small>

                  Zona kadastrale

                </small>

              </div>

              <strong>

                {totals.completedZones +

                  totals.reviewZones}

              </strong>

            </div>

          </section>

          <section className="application-kpis">
          <div className="total"><strong>{totals.applications}</strong><span>Banesa të evidentuara</span></div>
          {STATUS_OPTIONS.map(({ key, label }) => (
            <div key={key} className={key}>
              <strong>{totals[key === "public" ? "publicDisplay" : key]}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        </>

        {/* =================================================

            KALENDAR

            \\\\================================================= */}

        <section className="agenda-section">

          <div className="agenda-header">

            <div>

              <span className="eyebrow">

                Bashkitë dhe periudhat

                e evidentimit

              </span>

              <h2>

                Kalendar i evidentimit

                në terren

              </h2>

            </div>

            {selectedCalendar && (

              <button

                type="button"

                className="agenda-reset"

                onClick={() =>

                  setSelectedCalendar(

                    null

                  )

                }

              >

                Mbyll listën

              </button>

            )}

          </div>

          <div className="agenda-board">

            <div className="agenda-table-head">

              <span>

                Bashkia

              </span>

              <span>

                Periudha e evidentimit

              </span>

              <span>

                Statusi

              </span>

              <span>

                Zona

              </span>

              <span />

            </div>

            {municipalityAgenda.map(

              (item) => (

                <button

                  type="button"

                  key={item.id}

                  disabled={

                    !item.canOpen

                  }

                  className={`agenda-row ${selectedCalendar?.id ===

                      item.id

                      ? "selected"

                      : ""

                    } ${!item.canOpen

                      ? "locked"

                      : ""

                    }`}

                  onClick={() =>

                    handleAgendaClick(

                      item

                    )

                  }

                >

                  {/* BASHKIA */}

                  <div className="agenda-bashkia">

                    <small>

                      BASHKIA

                    </small>

                    <strong>

                      {item.bashkia}

                    </strong>

                    <span>

                      DV{" "}

                      {Array.isArray(item.drejtoriteVendore)

                        ? item.drejtoriteVendore.join(" · ")

                        : item.drejtoriteVendore}

                    </span>

                  </div>

                  {/* PERIUDHA */}

                  <div className="agenda-period">

                    <div className="agenda-date">

                      <small>

                        FILLIMI

                      </small>

                      <strong>

                        {item.startDate}

                      </strong>

                    </div>

                    <div className="agenda-line">

                      <i />

                      <span />

                      <i />

                    </div>

                    <div className="agenda-date agenda-date-end">

                      <small>

                        PËRFUNDIMI

                      </small>

                      <strong>

                        {item.endDate}

                      </strong>

                    </div>

                  </div>

                  {/* STATUS */}

                  <div>

                    <span

                      className={`agenda-status ${item.agendaStatus}`}

                    >

                      {item.agendaStatus ===

                        "completed"

                        ? "Përfunduar"

                        : item.agendaStatus ===

                          "active"

                          ? "Në terren"

                          : "Në pritje"}

                    </span>

                  </div>

                  {/* NUMRI I ZONAVE */}

                  <div className="agenda-count">

                    <strong>

                      {item.zones.length}

                    </strong>

                    <span>

                      ZK

                    </span>

                  </div>

                  {/* ACTION */}

                  <span className="agenda-arrow">

                    {item.canOpen

                      ? "↓"

                      : "🔒"}

                  </span>

                </button>

              )

            )}

          </div>

        </section>

        {/* =================================================

            LISTA E ZONAVE

            \\\\================================================= */}

        {selectedCalendar && (

          <section

            className="zones-section"

            id="zones-list"

          >

            <div className="zones-heading">

              <div>

                <span className="eyebrow">

                  ZONAT KADASTRALE

                </span>

                <h2>

                  Bashkia{" "}

                  {

                    selectedCalendar.bashkia

                  }

                </h2>

              </div>

              <span>

                {filteredZones.length}{" "}

                {filteredZones.length ===

                  1

                  ? "zonë"

                  : "zona"}

              </span>

            </div>

            <div className="zones-table">

              <div className="zones-table-head">

                <span>ZK</span>

                <span>Fshati</span>

                <span>Bashkia</span>

                <span>Statusi</span>

                <span>Afati</span>

                <span />

              </div>

              {filteredZones.map(

                (zone) => (

                  <button

                    type="button"

                   className={`zone-row ${normalize(zone.fshati) === "palase" ? "clickable" : "disabled"}`}

                   // className="zone-row disabled"

                   key={zone.id}

                  ref={(el) => { zoneRefs.current[String(zone.id)] = el; }}

                    disabled={getZoneStatus(zone) !== "completed"}

                   // disabled

                   onClick={() => {

                     if (getZoneStatus(zone) === "completed") {

                       setSelectedZone(zone);

                     }

                   }}

                  >

                    <div className="zone-cell">

                      <small>

                        ZK

                      </small>

                      <strong>

                        {zone.zk || "—"}

                      </strong>

                    </div>

                    <div className="zone-cell">

                      <small>

                        Fshati

                      </small>

                      <span>

                        {zone.fshati}

                      </span>

                    </div>

                    <div className="zone-cell">

                      <small>

                        Bashkia

                      </small>

                      <span>

                        {zone.bashkia}

                      </span>

                    </div>

                    <div className="zone-cell">

                      <small>

                        Statusi

                      </small>

                      <span

                        className={`zone-status ${getZoneStatus(zone)}`}

                      >

                        {getZoneStatus(zone) === "completed"

                          ? "Përfunduar"

                          : getZoneStatus(zone) === "review"

                            ? "Në shqyrtim"

                            : "Planifikuar"}

                      </span>

                    </div>

                    <div className="zone-cell">

                      <small>

                        Afati

                      </small>

                      <span>

                        {zone.startDate ||

                          selectedCalendar.startDate}

                        {" — "}

                        {zone.endDate ||

                          selectedCalendar.endDate}

                      </span>

                    </div>

                    <span className="zone-arrow">

                      →

                    </span>

                  </button>

                )

              )}

              {filteredZones.length ===

                0 && (

                  <div className="zones-empty">

                    Nuk u gjet asnjë zonë

                    për periudhën e

                    zgjedhur.

                  </div>

                )}

            </div>

          </section>

        )}

      </main>

      {/* =================================================

          MODAL ZONE

          \\\\================================================= */}

      {selectedZone && (

        <div

          className="modal-overlay"

          onMouseDown={() =>

            setSelectedZone(null)

          }

        >

          <div

            className="zone-modal"

            onMouseDown={(e) =>

              e.stopPropagation()

            }

          >

            <button

              type="button"

              className="modal-close"

              onClick={() =>

                setSelectedZone(null)

              }

            >

              ×

            </button>

            <span className="eyebrow">

              ZONA KADASTRALE

            </span>

            <h2>

              ZK{" "}

              {selectedZone.zk ||

                "—"}

            </h2>

            <p className="zone-location">

              {selectedZone.fshati}

              {" · "}

              {selectedZone.bashkia}

              {" · "}

              {selectedZone.dv}

            </p>

            <div className="zone-modal-summary">

              <div>

                <span>

                  Periudha e

                  evidentimit

                </span>

                <strong>

                  {selectedZone.startDate ||

                    selectedCalendar

                      ?.startDate}

                  {" — "}

                  {selectedZone.endDate ||

                    selectedCalendar

                      ?.endDate}

                </strong>

              </div>

              <div>

                <span>

                  Evidentime

                </span>

                <strong>

                  {

                    getCounts(

                      selectedZone

                    ).total

                  }

                </strong>

              </div>

            </div>

            <div className="zone-options">

              {/* PAJISUR ME VENDIM */}

              <button

                type="button"

                className="zone-option approved"

                onClick={() =>

                  openApplicationsList(

                    selectedZone,

                    "approved",

                    "Pajisur me vendim"

                  )

                }

              >

                <span className="option-dot" />

                <div>

                  <strong>

                    Pajisur me vendim

                  </strong>

                  <small>

                    Shiko listën

                  </small>

                </div>

                <b>

                  {

                    getCounts(

                      selectedZone

                    ).approved

                  }

                </b>

                <i>→</i>

              </button>

              {/* AFISHIM PUBLIK */}

              <button

                type="button"

                className="zone-option public"

                onClick={() =>

                  openApplicationsList(

                    selectedZone,

                    "public",

                    "Afishim publik"

                  )

                }

              >

                <span className="option-dot" />

                <div>

                  <strong>

                    Afishim publik

                  </strong>

                  <small>

                    Shiko listën

                  </small>

                </div>

                <b>

                  {

                    getCounts(

                      selectedZone

                    ).publicDisplay

                  }

                </b>

                <i>→</i>

              </button>

              {/* MUNGESË DOKUMENTACIONI */}

              <button

                type="button"

                className="zone-option missing"

                onClick={() =>

                  openApplicationsList(

                    selectedZone,

                    "missing",

                    "Mungesë dokumentacioni"

                  )

                }

              >

                <span className="option-dot" />

                <div>

                  <strong>

                    Mungesë

                    dokumentacioni

                  </strong>

                  <small>

                    Shiko tabelën

                  </small>

                </div>

                <b>

                  {

                    getCounts(

                      selectedZone

                    ).missing

                  }

                </b>

                <i>→</i>

              </button>

              {STATUS_OPTIONS.filter(({ key }) => ["noAccess", "inProcess", "other"].includes(key)).map(({ key, label }) => (

              <button

                key={key}

                type="button"

                className={`zone-option ${key}`}

                onClick={() => openApplicationsList(selectedZone, key, label)}

              >

                <span className="option-dot" />

                <div><strong>{label}</strong><small>Shiko listën</small></div>

                <b>{getCounts(selectedZone)[key]}</b>

                <i>→</i>

              </button>

            ))}

            {/* HARTA E ZONËS */}

            <button

  type="button"

  className="zone-option map"

  onClick={() => openMap(selectedZone)}

>

  <span className="option-dot" />

  <div>

    <strong>Shiko të dhënat në hartë</strong>

    <small>{selectedZone.fshati}</small>

  </div>

  <i>→</i>

</button>

            </div>

          </div>

        </div>

      )}

      {/* =================================================

          MODAL LISTA APLIKIMEVE

          \\\\================================================= */}

      {listModal && (

        <div

          className="modal-overlay"

          onMouseDown={

            closeListModal

          }

        >

          <div

            className="applications-modal"

            onMouseDown={(e) =>

              e.stopPropagation()

            }

          >

            <button

              type="button"

              className="modal-close"

              onClick={

                closeListModal

              }

            >

              ×

            </button>

            <div className="applications-modal-title">

              <span className="eyebrow">

                ZK{" "}

                {listModal.zone.zk ||

                  "—"}

                {" · "}

                {

                  listModal.zone

                    .fshati

                }

              </span>

              <h2>

                {listModal.title}

              </h2>

              <p>

                Kërkoni sipas emrit, atësisë, mbiemrit ose statusit.

              </p>

            </div>

            {/* SEARCH LISTA */}

            <div className="nid-search">

              <span>⌕</span>

              <input

                type="text"

                value={listSearch}

                onChange={(e) =>

                  setListSearch(

                    e.target.value

                  )

                }

                placeholder="Kërko në listë..."

                autoFocus

                autoComplete="off"

              />

              {listSearch && (

                <button

                  type="button"

                  onClick={() =>

                    setListSearch("")

                  }

                >

                  ×

                </button>

              )}

            </div>

            <div className="applications-meta">

              <span>

                <strong>

                  {

                    filteredListItems.length

                  }

                </strong>{" "}

                {filteredListItems.length ===

                  1

                  ? "rezultat"

                  : "rezultate"}

              </span>

              <span>

                {listModal.zone

                  .startDate ||

                  selectedCalendar

                    ?.startDate}

                {" — "}

                {listModal.zone

                  .endDate ||

                  selectedCalendar

                    ?.endDate}

              </span>

            </div>

            {/* LISTA */}

            <div className="applications-list">

              <div className="applications-list-head">

                <span>Nr.</span>

                <span>Emër</span>

                <span>Atësi</span>

                <span>Mbiemër</span>

                <span>Statusi</span>

              </div>

              {filteredListItems.map((item, index) => {

                const applicationStatus = getApplicationStatus(item);

                return (

                  <div className="applications-list-row" key={item.id || index}>

                    <strong className="app-code">{item.id || index + 1}</strong>

                    <span>{item["Emër"] || "—"}</span>

                    <span>{item["Atësi"] || "—"}</span>

                    <span>{item["Mbiemër"] || "—"}</span>

                    <span className={`application-status ${applicationStatus}`}>

                      {item.Statusi || item.status || item.Kategoria || "—"}

                  </span>

                  </div>

                );

              })}

              {filteredListItems.length ===

                0 && (

                  <div className="applications-empty">

                    <strong>

                      Nuk u gjet aplikim

                    </strong>

                    <span>

                      Provoni një kërkim tjetër.

                    </span>

                  </div>

                )}

            </div>

          </div>

        </div>

      )}

    </div>

  );

}