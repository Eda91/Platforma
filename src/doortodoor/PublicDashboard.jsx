import { useMemo, useState } from "react";
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

const parseDate = (value) => {
  if (!value) return new Date(0);

  const [day, month, year] = value.split(".");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );
};

const getCounts = (zone) => {
  const applications = zone.applications || [];

  const approved = applications.filter(
    (item) => item.status === "approved"
  ).length;

  const publicDisplay = applications.filter(
    (item) => item.status === "public"
  ).length;

  const missing = applications.filter(
    (item) => item.status === "missing"
  ).length;

  const noAccess = applications.filter(
    (item) => item.status === "no-access"
  ).length;

  return {
    total: applications.length,
    approved,
    publicDisplay,
    missing,
    noAccess,
  };
};

/* =========================================================
   COMPONENT
   ========================================================= */

export default function PublicDashboard() {
  const navigate = useNavigate();

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
    nidSearch,
    setNidSearch,
  ] = useState("");

  /* ======================================================
     GLOBAL TOTALS
     ====================================================== */

  const totals = useMemo(() => {
    const result = {
      applications: 0,
      approved: 0,
      publicDisplay: 0,
      missing: 0,
      noAccess: 0,

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

      if (
        zone.zoneStatus === "completed"
      ) {
        result.completedZones += 1;
      }

      if (
        zone.zoneStatus === "review"
      ) {
        result.reviewZones += 1;
      }

      if (
        zone.zoneStatus === "planned"
      ) {
        result.plannedZones += 1;
      }
    });

    return result;
  }, []);

  /* ======================================================
     KALENDAR NGA calendar.json

     Çdo rekord i calendar.json qëndron më vete.
     Nuk grupojmë më sipas bashkisë.
     ====================================================== */

  const municipalityAgenda = useMemo(() => {
    return [...CALENDAR]
      .sort(
        (a, b) =>
          parseDate(a.startDate) -
          parseDate(b.startDate)
      )
      .map((calendarItem) => {
        const locations =
          calendarItem.locations || [];

        /*
          Lidhim locations të calendar.json
          me fshati të zones.json.
        */
        const zones = ZONES.filter(
          (zone) =>
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
            calendarItem.status ||
            "waiting",

          canOpen:
            calendarItem.status ===
              "active" ||
            calendarItem.status ===
              "completed",
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

      const matchesStatus =
        statusFilter === "all" ||
        zone.zoneStatus ===
          statusFilter;

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
     SEARCH SIPAS NID
     ====================================================== */

  const filteredListItems =
    useMemo(() => {
      if (!listModal) {
        return [];
      }

      const q =
        normalize(nidSearch);

      if (!q) {
        return listModal.items;
      }

      return listModal.items.filter(
        (item) =>
          normalize(
            item.nid || ""
          ).includes(q)
      );
    }, [
      listModal,
      nidSearch,
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
          item.status === category
      );

    setSelectedZone(zone);

    setNidSearch("");

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
    setNidSearch("");

    if (zoneToRestore) {
      setSelectedZone(
        zoneToRestore
      );
    }
  };

  /* ======================================================
     OPEN MAP
     ====================================================== */

  const openMap = (
    zone,
    category
  ) => {
    setSelectedZone(null);

    navigate(
      `/doortodoor?zk=${encodeURIComponent(
        zone.zk || ""
      )}&category=${encodeURIComponent(
        category
      )}`
    );
  };

  /* ======================================================
     JSX
     ====================================================== */

  return (
    <div className="public-dashboard">

      {/* =================================================
          HEADER
          ================================================= */}

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

        {/* =================================================
            SEARCH
            ================================================= */}
{false && (
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
              <span>⌕</span>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Kërko ZK, fshat, bashki..."
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  aria-label="Pastro kërkimin"
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

        {/* =================================================
            KPI ZONA
            ================================================= */}

        <section className="main-kpis">

          <button
            type="button"
            className={`main-kpi completed ${
              statusFilter ===
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
            className={`main-kpi review ${
              statusFilter ===
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
                Zona gjithsej të
                trajtuara
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

        {/* =================================================
            KPI APLIKIME
            ================================================= */}

        <section className="application-kpis">

          <div>
            <strong>
              {totals.applications}
            </strong>

            <span>
              Aplikime të verifikuara
            </span>
          </div>

          <div>
            <strong>
              {totals.approved}
            </strong>

            <span>
              Pajisur me vendim
            </span>
          </div>

          <div>
            <strong>
              {totals.publicDisplay}
            </strong>

            <span>
              Afishim publik
            </span>
          </div>

          <div>
            <strong>
              {totals.missing}
            </strong>

            <span>
              Mungesë dokumentacioni
            </span>
          </div>

          <div>
            <strong>
              {totals.noAccess}
            </strong>

            <span>
              Pa akses
            </span>
          </div>

        </section>
</>
)}
        {/* =================================================
            KALENDAR
            ================================================= */}

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
                  className={`agenda-row ${
                    selectedCalendar?.id ===
                    item.id
                      ? "selected"
                      : ""
                  } ${
                    !item.canOpen
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
                      {Array.isArray(item.dv)
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
            ================================================= */}

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
                    className="zone-row"
                    key={zone.id}
                    /*
                    onClick={() =>
                      setSelectedZone(
                        zone
                      )
                    }
                      */
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
                        className={`zone-status ${zone.zoneStatus}`}
                      >
                        {zone.zoneStatus ===
                        "completed"
                          ? "Përfunduar"
                          : zone.zoneStatus ===
                            "review"
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
          ================================================= */}

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
                  Aplikime
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
                  openMap(
                    selectedZone,
                    "missing-docs"
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
                    Shiko rastet në
                    hartë
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

              {/* BANESË PA AKSES */}

              <button
                type="button"
                className="zone-option no-access"
                onClick={() =>
                  openMap(
                    selectedZone,
                    "no-access"
                  )
                }
              >
                <span className="option-dot" />

                <div>
                  <strong>
                    Banesë pa akses
                  </strong>

                  <small>
                    Shiko rastet në
                    hartë
                  </small>
                </div>

                <b>
                  {
                    getCounts(
                      selectedZone
                    ).noAccess
                  }
                </b>

                <i>→</i>
              </button>

            </div>
          </div>
        </div>
      )}

      {/* =================================================
          MODAL LISTA APLIKIMEVE
          ================================================= */}

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
                Kërkoni sipas NID
                për të gjetur
                aplikimin.
              </p>

            </div>

            {/* SEARCH NID */}

            <div className="nid-search">
              <span>⌕</span>

              <input
                type="text"
                value={nidSearch}
                onChange={(e) =>
                  setNidSearch(
                    e.target.value
                  )
                }
                placeholder="Kërko sipas NID..."
                autoFocus
                autoComplete="off"
              />

              {nidSearch && (
                <button
                  type="button"
                  onClick={() =>
                    setNidSearch("")
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
                <span>
                  Nr. aplikimi
                </span>

                <span>
                  Statusi
                </span>

                <span>
                  Përshkrimi
                </span>
              </div>

              {filteredListItems.map(
                (item) => (
                  <div
                    className="applications-list-row"
                    key={item.id}
                  >
                    <strong className="app-code">
                      {item.code}
                    </strong>

                    <span
                      className={`application-status ${item.status}`}
                    >
                      {item.status ===
                      "approved"
                        ? "Pajisur me vendim"
                        : item.status ===
                          "public"
                        ? "Afishim publik"
                        : item.status ===
                          "missing"
                        ? "Mungesë dokumentacioni"
                        : item.status ===
                          "no-access"
                        ? "Banesë pa akses"
                        : item.status}
                    </span>

                    <span className="app-description">
                      {
                        item.description
                      }
                    </span>
                  </div>
                )
              )}

              {filteredListItems.length ===
                0 && (
                <div className="applications-empty">
                  <strong>
                    Nuk u gjet aplikim
                  </strong>

                  <span>
                    Kontrolloni NID
                    dhe provoni përsëri.
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