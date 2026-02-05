import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import MapView from "./Map";
import Lista from "./Lista";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/lista" element={<Lista />} />
      </Routes>
    </Router>
  );
}
