import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PublicDashboard.css";

/*
  =========================================================
  DEMO DATA
  =========================================================

  Këto janë të dhëna DEMO për ndërfaqen.
  Më pas ZONES mund të vijë nga API / JSON / DB.

  E rëndësishme:
  - nid përdoret vetëm për kërkim
  - nid NUK afishohet në listë
*/

const ZONES = [
  {
    id: 1,
    zk: "2955",
    dv: "Vlorë",
    bashkia: "Himarë",
    fshati: "Piqeras",
    zoneStatus: "completed",
    startDate: "10.08.2026",
    endDate: "28.08.2026",

    applications: [
      {
        id: 1,
        code: "PIQ-001",
        nid: "A11111111A",
        status: "approved",
        description: "Pajisur me vendim",
      },
      {
        id: 2,
        code: "PIQ-002",
        nid: "A22222222B",
        status: "approved",
        description: "Pajisur me vendim",
      },
      {
        id: 3,
        code: "PIQ-003",
        nid: "A33333333C",
        status: "public",
        description: "Afishim publik",
      },
    ],
  },

  {
    id: 2,
    zk: "3131",
    dv: "Vlorë",
    bashkia: "Himarë",
    fshati: "Palasë",
    zoneStatus: "review",
    startDate: "09.09.2026",
    endDate: "17.09.2026",

    applications: [
      {
        id: 1,
        code: "PAL-001",
        nid: "J12345678A",
        status: "missing",
        description: "Deklaratë noteriale",
      },
      {
        id: 2,
        code: "PAL-002",
        nid: "K98765432B",
        status: "approved",
        description: "Pajisur me vendim",
      },
      {
        id: 3,
        code: "PAL-003",
        nid: "L23456789C",
        status: "public",
        description: "Afishim publik",
      },
      {
        id: 4,
        code: "PAL-004",
        nid: "M34567890D",
        status: "no-access",
        description: "Banesë pa akses",
      },
      {
        id: 5,
        code: "PAL-005",
        nid: "N45678901E",
        status: "approved",
        description: "Pajisur me vendim",
      },
      {
        id: 6,
        code: "PAL-006",
        nid: "P56789012F",
        status: "public",
        description: "Afishim publik",
      },
    ],
  },

  {
    id: 3,
    zk: "3067",
    dv: "Korçë",
    bashkia: "Korçë",
    fshati: "Shembull",
    zoneStatus: "review",
    startDate: "20.09.2026",
    endDate: "04.10.2026",

    applications: [
      {
        id: 1,
        code: "3067-001",
        nid: "B11111111A",
        status: "missing",
        description: "Dëshmi trashëgimie",
      },
      {
        id: 2,
        code: "3067-002",
        nid: "B22222222B",
        status: "missing",
        description: "Dokumentacion plotësues",
      },
      {
        id: 3,
        code: "3067-003",
        nid: "B33333333C",
        status: "public",
        description: "Afishim publik",
      },
    ],
  },

  {
    id: 4,
    zk: "5001",
    dv: "Berat",
    bashkia: "Berat",
    fshati: "Shembull Berat",
    zoneStatus: "planned",
    startDate: "05.10.2026",
    endDate: "20.10.2026",

    applications: [],
  },
];

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

  const [day, month, year] =
    value.split(".");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );
};

const getCounts = (zone) => {
  const applications =
    zone.applications || [];

  const approved =
    applications.filter(
      (item) =>
        item.status === "approved"
    ).length;

  const publicDisplay =
    applications.filter(
      (item) =>
        item.status === "public"
    ).length;

  const missing =
    applications.filter(
      (item) =>
        item.status === "missing"
    ).length;

  const noAccess =
    applications.filter(
      (item) =>
        item.status === "no-access"
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

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  /*
    null =
    lista e ZK-ve nuk shfaqet.
  */

  const [
    selectedBashkia,
    setSelectedBashkia,
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
    };

    ZONES.forEach((zone) => {
      const counts =
        getCounts(zone);

      result.applications +=
        counts.total;

      result.approved +=
        counts.approved;

      result.publicDisplay +=
        counts.publicDisplay;

      result.missing +=
        counts.missing;

      result.noAccess +=
        counts.noAccess;

      if (
        zone.zoneStatus ===
        "completed"
      ) {
        result.completedZones += 1;
      }

      if (
        zone.zoneStatus ===
        "review"
      ) {
        result.reviewZones += 1;
      }
    });

    return result;
  }, []);

  /* ======================================================
     AGJENDA SIPAS BASHKIVE

     LOGJIKA:

     1. Grupohen ZK sipas bashkisë.
     2. Renditen bashkitë sipas datës së fillimit.
     3. Bashkia konsiderohet e përfunduar
        vetëm nëse TË GJITHA ZK-të e saj
        janë completed.
     4. Vetëm bashkia e parë që nuk ka
        përfunduar bëhet ACTIVE.
     5. Të gjitha pas saj janë WAITING.
     ====================================================== */

  const municipalityAgenda =
    useMemo(() => {
      const groups = new Map();

      ZONES.forEach((zone) => {
        if (
          !groups.has(
            zone.bashkia
          )
        ) {
          groups.set(
            zone.bashkia,
            {
              bashkia:
                zone.bashkia,

              dv: zone.dv,

              zones: [],
            }
          );
        }

        groups
          .get(zone.bashkia)
          .zones.push(zone);
      });

      const agenda =
        Array.from(
          groups.values()
        )
          .map((group) => {
            /*
              Data e parë e
              evidentimit
            */

            const sortedStart = [
              ...group.zones,
            ].sort(
              (a, b) =>
                parseDate(
                  a.startDate
                ) -
                parseDate(
                  b.startDate
                )
            );

            /*
              Data e fundit
              e evidentimit
            */

            const sortedEnd = [
              ...group.zones,
            ].sort(
              (a, b) =>
                parseDate(
                  b.endDate
                ) -
                parseDate(
                  a.endDate
                )
            );

            /*
              Bashkia ka
              përfunduar vetëm
              kur çdo ZK është
              completed.
            */

            const allCompleted =
              group.zones.length >
                0 &&
              group.zones.every(
                (zone) =>
                  zone.zoneStatus ===
                  "completed"
              );

            return {
              ...group,

              startDate:
                sortedStart[0]
                  ?.startDate,

              endDate:
                sortedEnd[0]
                  ?.endDate,

              allCompleted,
            };
          })
          .sort(
            (a, b) =>
              parseDate(
                a.startDate
              ) -
              parseDate(
                b.startDate
              )
          );

      /*
        Gjej bashkinë e parë
        që nuk ka përfunduar.
      */

      const activeIndex =
        agenda.findIndex(
          (item) =>
            !item.allCompleted
        );

      return agenda.map(
        (item, index) => {
          /*
            PËRFUNDUAR
          */

          if (
            item.allCompleted
          ) {
            return {
              ...item,

              agendaStatus:
                "completed",

              canOpen: true,
            };
          }

          /*
            BASHKIA AKTIVE
          */

          if (
            index ===
            activeIndex
          ) {
            return {
              ...item,

              agendaStatus:
                "active",

              canOpen: true,
            };
          }

          /*
            BASHKITË QË
            PRESIN RADHËN
          */

          return {
            ...item,

            agendaStatus:
              "waiting",

            canOpen: false,
          };
        }
      );
    }, []);

  /* ======================================================
     FILTER ZONES

     Lista shfaqet vetëm pasi
     është zgjedhur bashkia.
     ====================================================== */

  const filteredZones =
    useMemo(() => {
      if (!selectedBashkia) {
        return [];
      }

      const q =
        normalize(search);

      return ZONES.filter(
        (zone) => {
          const searchText =
            normalize(`
              ${zone.zk}
              ${zone.fshati}
              ${zone.bashkia}
              ${zone.dv}
              ${zone.startDate}
              ${zone.endDate}
            `);

          const matchesBashkia =
            zone.bashkia ===
            selectedBashkia;

          const matchesSearch =
            !q ||
            searchText.includes(
              q
            );

          const matchesStatus =
            statusFilter ===
              "all" ||
            zone.zoneStatus ===
              statusFilter;

          return (
            matchesBashkia &&
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      selectedBashkia,
      search,
      statusFilter,
    ]);

  /* ======================================================
     SEARCH SIPAS NID

     NID PËRDORET VETËM PËR
     KËRKIM.

     NUK AFISHOHET.
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
     CLICK BASHKIA
     ====================================================== */

  const handleAgendaClick = (
    item
  ) => {
    /*
      Nëse është waiting,
      nuk hapet.
    */

    if (!item.canOpen) {
      return;
    }

    setSelectedBashkia(
      item.bashkia
    );

    /*
      Kur zgjedhim bashkinë,
      pastrojmë filtrat që të
      duken të gjitha ZK-të
      e saj.
    */

    setSearch("");

    setStatusFilter("all");

    /*
      Pas renderimit,
      zbresim te lista.
    */

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
  const items = zone.applications.filter(
    (item) => item.status === category
  );

  // MOS e humb zonën
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
  // Ruajmë zonën që kishte hapur listën
  const zoneToRestore = listModal?.zone;

  setListModal(null);
  setNidSearch("");

  // Rikthe modalin e Zonës Kadastrale
  if (zoneToRestore) {
    setSelectedZone(zoneToRestore);
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
      `/doortodoor?zk=${zone.zk}&category=${category}`
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
            Platforma e Evidentimit
            në Terren
          </h1>

          <p>
            Derë më Derë
          </p>
        </div>

         <img
                src={`${import.meta.env.BASE_URL}images/logo1.jpg`}
                alt="Agjencia Shtetërore e Kadastrës"
                className="doortodoor-logo-img"
                style={{ width: "150px", height: "auto" }}
                />
      </header>

      <main className="dashboard-content">
        {/* =================================================
            SEARCH
            ================================================= */}

        <section className="top-search">
          <div className="top-search-copy">
            <span className="eyebrow">
              INFORMACION PUBLIK
            </span>

            <h2>
              Gjeni zonën
              kadastrale
            </h2>

            <p>
              Kërkoni sipas ZK,
              fshatit, bashkisë
              ose drejtorisë
              vendore.
            </p>
          </div>

          <div className="main-search-controls">
            <div className="main-search-input">
              <span>
                ⌕
              </span>

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
              value={
                statusFilter
              }
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
                Zona të
                përfunduara
              </span>

              <small>
                Proces i përfunduar
              </small>
            </div>

            <strong>
              {
                totals.completedZones
              }
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
              {
                totals.reviewZones
              }
            </strong>
          </button>

          <div className="main-kpi total">
            <div>
              <span>
                Zona gjithsej të trajtuara 
              </span>

              <small>
                Zona kadastrale
              </small>
            </div>

           <strong>
          {totals.completedZones + totals.reviewZones}
        </strong>
          </div>
        </section>

        {/* =================================================
            KPI APLIKIME
            ================================================= */}

        <section className="application-kpis">
          <div>
            <strong>
              {
                totals.applications
              }
            </strong>

            <span>
              Aplikime të
              verifikuara
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
              {
                totals.publicDisplay
              }
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
              Mungesë
              dokumentacioni
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

        {/* =================================================
            AGJENDA E BASHKIVE
            ================================================= */}

        <section className="agenda-section">
          <div className="agenda-header">
            <div>
              <span className="eyebrow">
                Bashkitë dhe
                periudhat e
                evidentimit
              </span>

              <h2>
                Kalendar i evidentimit në terren
              </h2>

            </div>

            {selectedBashkia && (
              <button
                type="button"
                className="agenda-reset"
                onClick={() =>
                  setSelectedBashkia(
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
                Periudha e
                evidentimit
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
                  key={
                    item.bashkia
                  }
                  disabled={
                    !item.canOpen
                  }
                  className={`agenda-row ${
                    selectedBashkia ===
                    item.bashkia
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
                      {
                        item.bashkia
                      }
                    </strong>

                    <span>
                      DV {item.dv}
                    </span>
                  </div>

                  {/* PERIUDHA */}

                  <div className="agenda-period">
                    <div className="agenda-date">
                      <small>
                        FILLIMI
                      </small>

                      <strong>
                        {
                          item.startDate
                        }
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
                        {
                          item.endDate
                        }
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

                  {/* NUMRI ZK */}

                  <div className="agenda-count">
                    <strong>
                      {
                        item.zones
                          .length
                      }
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

            SHFAQET VETËM PAS
            KLIKIMIT MBI AGJENDË
            ================================================= */}

        {selectedBashkia && (
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
                    selectedBashkia
                  }
                </h2>

                <p>
                  Zonat e
                  evidentimit në
                  terren për këtë
                  bashki.
                </p>
              </div>

              <span>
                {
                  filteredZones.length
                }{" "}
                zona
              </span>
            </div>

            <div className="zones-table">
              <div className="zones-table-head">
                <span>
                  ZK
                </span>

                <span>
                  Fshati
                </span>

                <span>
                  Bashkia
                </span>

                <span>
                  Statusi
                </span>

                <span>
                  Afati
                </span>

                <span />
              </div>

              {filteredZones.map(
                (zone) => (
                  <button
                    type="button"
                    className="zone-row"
                    key={zone.id}
                    onClick={() =>
                      setSelectedZone(
                        zone
                      )
                    }
                  >
                    <div className="zone-cell">
                      <small>
                        ZK
                      </small>

                      <strong>
                        {zone.zk}
                      </strong>
                    </div>

                    <div className="zone-cell">
                      <small>
                        Fshati
                      </small>

                      <span>
                        {
                          zone.fshati
                        }
                      </span>
                    </div>

                    <div className="zone-cell">
                      <small>
                        Bashkia
                      </small>

                      <span>
                        {
                          zone.bashkia
                        }
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
                        {
                          zone.startDate
                        }
                        {" — "}
                        {
                          zone.endDate
                        }
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
                  Nuk u gjet
                  asnjë zonë për
                  filtrat e
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
              {selectedZone.zk}
            </h2>

            <p className="zone-location">
              {
                selectedZone.fshati
              }
              {" · "}
              {
                selectedZone.bashkia
              }
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
                  {
                    selectedZone.startDate
                  }
                  {" — "}
                  {
                    selectedZone.endDate
                  }
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

                <i>
                  →
                </i>
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
                    )
                      .publicDisplay
                  }
                </b>

                <i>
                  →
                </i>
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

                <i>
                  →
                </i>
              </button>

              {/* PA AKSES */}

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

                <i>
                  →
                </i>
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
                {
                  listModal.zone.zk
                }
                {" · "}
                {
                  listModal.zone
                    .fshati
                }
              </span>

              <h2>
                {
                  listModal.title
                }
              </h2>

              <p>
                Kërkoni sipas
                NID për të gjetur
                aplikimin.
              </p>
            </div>

            {/* SEARCH NID */}

            <div className="nid-search">
              <span>
                ⌕
              </span>

              <input
                type="text"
                value={
                  nidSearch
                }
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
                {
                  listModal.zone
                    .startDate
                }
                {" — "}
                {
                  listModal.zone
                    .endDate
                }
              </span>
            </div>

            {/* LISTA
                NID NUK AFISHOHET */}

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
                      {
                        item.code
                      }
                    </strong>

                    <span
                      className={`application-status ${item.status}`}
                    >
                      {item.status ===
                      "approved"
                        ? "Pajisur me vendim"
                        : "Afishim publik"}
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
                    Nuk u gjet
                    aplikim
                  </strong>

                  <span>
                    Kontrolloni NID
                    dhe provoni
                    përsëri.
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