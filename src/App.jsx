import React from "react";
import { HashRouter as Router,BrowserRouter, Routes, Route } from "react-router-dom";
import MapView from "./Map";
import Lista from "./Lista";
import ZonaDashboard from "./referenca";
import Login from "./Login";
import Statistics from "./statistic";
import ProtectedRoute from "./ProtectedRoute";

export default function App() {
  return (
    <Router>
     <Routes>
   {/* <Route path="/map/:zk" element={<MapView />} /> */}
      <Route path="/" element={<MapView />} />
      <Route path="/:zk" element={<MapView />} />

      <Route path="/lista" element={<Lista />} />
      <Route path="/listarf" element={<ZonaDashboard />} />
      <Route path="/login" element={<Login />} />
      <Route
    path="/statistic"
    element={
      <ProtectedRoute>
        <Statistics />
      </ProtectedRoute>
    }
  />
    </Routes>
    </Router>
  );
}
