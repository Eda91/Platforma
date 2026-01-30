import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MapView from "./Map";
import Lista from "./Lista";

export default function App() {
  return (
    <Router basename="/Platforma">
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/lista" element={<Lista />} />
      </Routes>
    </Router>
  );
}
