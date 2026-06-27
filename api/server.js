const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "super_secret_key";

// fake user (later DB)
const user = {
  username: "admin",
  password: "123456",
};

// LOGIN
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (username === user.username && password === user.password) {
    const token = jwt.sign(
      { username },
      SECRET,
      { expiresIn: "1h" }
    );

    return res.json({ token });
  }

  return res.status(401).json({ message: "Invalid credentials" });
});

// PROTECTED ROUTE
app.get("/api/statistics", (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) return res.sendStatus(401);

  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    res.json({
      message: "Protected data",
      user: decoded.username,
    });
  } catch (err) {
    res.sendStatus(403);
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));