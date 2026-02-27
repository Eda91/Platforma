import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import MapView from "./Map";
import Lista from "./Lista";
import ZonaDashboard from "./referenca";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/lista" element={<Lista />} />
         <Route path="/referenca" element={<ZonaDashboard />} />
      </Routes>
    </Router>
  );
}
