import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";

function isValidPolygonGeometry(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return false;

  if (geometry.type === "Polygon") {
    return Array.isArray(geometry.coordinates) &&
      geometry.coordinates[0]?.length >= 3;
  }

  if (geometry.type === "MultiPolygon") {
    return Array.isArray(geometry.coordinates) &&
      geometry.coordinates[0]?.[0]?.length >= 3;
  }

  return false;
}

export default function MapView() {
  const mapRef = useRef(null);
  const featuresRef = useRef([]);
  const zkLayerRef = useRef(null);
  const parcelLayerRef = useRef(null);
  const [nrSearch, setNrSearch] = useState("");
  const [nrPasurisArray, setNrPasurisArray] = useState([]);
  const [searchMessage, setSearchMessage] = useState("");

  useEffect(() => {
    if (mapRef.current) return;
    let alive = true;

    const map = L.map("map", {
      minZoom: 5,
      maxZoom: 19,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      keyboard: true,
    }).setView([41.0, 20.0], 7.45);

    mapRef.current = map;

    // Base layers
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ).addTo(map);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom:19 }
    ).addTo(map);

    zkLayerRef.current = L.layerGroup().addTo(map);
    parcelLayerRef.current = L.layerGroup().addTo(map);

    const polygonStyle = {
      color: "orange",
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0,
    };

    const geojsonFiles = [
      "MM2487LO_ZK.geojson",
      "MM2487LO_N.geojson",
      "MM2487LO_P.geojson",
      "MM2487LO_T.geojson",
    ];

    featuresRef.current = [];
    let loaded = 0;
    const allNrPasuris = [];

    geojsonFiles.forEach((file) => {
      fetch(`/geojson/${file}`)
        .then((r) => r.json())
        .then((data) => {
          if (!alive) return;

          const targetLayer = file.includes("_ZK")
            ? zkLayerRef.current
            : parcelLayerRef.current;

          L.geoJSON(data.features || [], {
            renderer: L.svg(),
            filter: (f) => isValidPolygonGeometry(f.geometry),
            style: polygonStyle,
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {};

              if (p.NR_PASURIS) allNrPasuris.push(p.NR_PASURIS);

              featuresRef.current.push({
                layer,
                ZK: p.ZK ?? "",
                NR_PASURIS: p.NR_PASURIS ?? "",
                SIPERFAQE: p.SIPERFAQE ?? "",
                bounds: layer.getBounds(),
              });

              // Create both tooltips but ZK tooltip hidden by default
              if (p.ZK) {
                const zkTooltip = L.tooltip({
                  permanent: true,
                  direction: "center",
                  className: "parcel-tooltip zk-tooltip hidden-tooltip",
                })
                  .setContent(`<div>ZK: ${p.ZK}</div>`)
                  .setLatLng(layer.getBounds().getCenter())
                  .addTo(map);
                layer.zkTooltip = zkTooltip;
              }

              if (p.NR_PASURIS) {
                const nrTooltip = L.tooltip({
                  permanent: true,
                  direction: "center",
                  className: "parcel-tooltip nr-tooltip hidden-tooltip",
                })
                  .setContent(
                    `<div>
                       <div>${p.NR_PASURIS}</div>
                       <div class="parcel-area">${p.SIPERFAQE} m²</div>
                     </div>`
                  )
                  .setLatLng(layer.getBounds().getCenter())
                  .addTo(map);
                layer.nrTooltip = nrTooltip;
              }
            },
          }).addTo(targetLayer);

          loaded++;
          if (loaded === geojsonFiles.length) {
            setNrPasurisArray(allNrPasuris);
            updateTooltipVisibility(); // initial visibility
          }
        });
    });

    // Smooth tooltip visibility based on zoom
    const updateTooltipVisibility = () => {
      const zoom = map.getZoom();
      featuresRef.current.forEach(({ layer }) => {
        if (layer.zkTooltip) {
          if (zoom < 14) {
            layer.zkTooltip.getElement()?.classList.remove("hidden-tooltip");
          } else {
            layer.zkTooltip.getElement()?.classList.add("hidden-tooltip");
          }
        }
        if (layer.nrTooltip) {
          if (zoom >= 14) {
            layer.nrTooltip.getElement()?.classList.remove("hidden-tooltip");
          } else {
            layer.nrTooltip.getElement()?.classList.add("hidden-tooltip");
          }
        }
      });
    };

    map.on("zoomend", updateTooltipVisibility);

    return () => {
      alive = false;
      map.off("zoomend", updateTooltipVisibility);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleSearch = () => {
    if (!nrPasurisArray.length) return;

    const searchValue = nrSearch.trim().toLowerCase();
    const foundNr = nrPasurisArray.find((nr) =>
      nr.toString().toLowerCase().includes(searchValue)
    );

    if (foundNr) {
      const feature = featuresRef.current.find(f => f.NR_PASURIS === foundNr);
      if (feature) {
        mapRef.current.fitBounds(feature.bounds, { maxZoom: 18 });
        feature.layer.setStyle({
          color: "red",
          weight: 4,
          opacity: 1,
          fillOpacity: 0.5,
        });
        setTimeout(() => {
          feature.layer.setStyle({
            color: "orange",
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0,
          });
        }, 3000);
        setSearchMessage("");
      }
    } else {
      setSearchMessage("Numri i pasurise nuk ekziston.");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div className="sidebar">
        <h3>Kërko parcelën</h3>
        <input
          placeholder="Numri Pasurise"
          value={nrSearch}
          onChange={(e) => setNrSearch(e.target.value)}
        />
        <button onClick={handleSearch}>Kërko</button>
        {searchMessage && <p>{searchMessage}</p>}
      </div>
      <div id="map" style={{ flex: 1 }} />
    </div>
  );
}
