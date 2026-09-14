
import React from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import MapView from "./Map";
import Lista from "./Lista";
import ZonaDashboard from "./referenca";
import Login from "./Login";
import Statistics from "./statistic";
import ProtectedRoute from "./ProtectedRoute";
import DoorToDoor from "./doortodoor/doortodoor";
import PublicDashboard from "./doortodoor/PublicDashboard";

export default function App() {
  return (
    <Router>
      <Routes>

        {/* Harta kryesore */}
        <Route path="/" element={<MapView />} />

        {/* Door to Door */}
        <Route
          path="/doortodoor"
          element={<DoorToDoor />}
        />
        <Route
          path="/dashboard"
          element={<PublicDashboard />}
        />

        {/* Faqe të tjera */}
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

        {/* ZK - duhet të jetë në fund */}
        <Route
          path="/:zk"
          element={<MapView />}
        />

      </Routes>
    </Router>
  );
}

