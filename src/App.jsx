import React from "react";
import MapView from "./Map";

export default function App() {
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <header style={{ padding: "10px", background: "#1e293b", color: "#fff" }}>
        <h2>Harta Kadastrale Online</h2>
      </header>

      <MapView />
    </div>
  );
}
