import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const loggedIn = localStorage.getItem("isLoggedIn") === "true";

  return loggedIn ? children : <Navigate to="/login" replace />;
}