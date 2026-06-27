import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../public/images/logo1.jpg";
export default function Login() {
  const [form, setForm] = useState({
    username: "admin",
    password: "123456"
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

 const navigate = useNavigate();

const handleLogin = (e) => {
  e.preventDefault();

  if (form.username === "admin" && form.password === "admin") {
    localStorage.setItem("isLoggedIn", "true");
    navigate("/statistic");
  } else {
    alert("Wrong credentials");
  }
};

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img
          src="images/logo1.jpg"
          alt="Logo"
          style={styles.logo}
        />

        <h2 style={styles.title}>Platforma e Regjistrimit Fillestar</h2>

        <p style={styles.subtitle}>
          Hyr në panelin e administrimit
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            name="username"
            placeholder="Përdoruesi"
          
            onChange={handleChange}
            style={styles.input}
          />

          <input
            type="password"
            name="password"
            placeholder="Fjalëkalimi"
    
            onChange={handleChange}
            style={styles.input}
          />

          <button type="submit" style={styles.button}>
            Hyr
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background:
      "linear-gradient(135deg,#0f172a,#1e3a8a,#2563eb)",
  },

  card: {
    width: 380,
    background: "#fff",
    padding: 35,
    borderRadius: 18,
    boxShadow: "0 20px 50px rgba(0,0,0,.25)",
    textAlign: "center",
  },

  logo: {
    width: 90,
    marginBottom: 15,
  },

  title: {
    margin: 0,
    color: "#0f172a",
  },

  subtitle: {
    color: "#64748b",
    marginBottom: 30,
    fontSize: 14,
  },

  input: {
    width: "100%",
    padding: 14,
    marginBottom: 18,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },

  button: {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    fontSize: 16,
    cursor: "pointer",
    transition: ".2s",
  },
};