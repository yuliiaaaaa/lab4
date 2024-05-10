const uuid = require("uuid");
const express = require("express");
const onFinished = require("on-finished");
const bodyParser = require("body-parser");
const path = require("path");
const port = 3000;
const fs = require("fs");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SESSION_KEY = "Authorization";

class Session {
  #sessions = {};

  constructor() {
    try {
      this.#sessions = fs.readFileSync("./sessions.json", "utf8");
      this.#sessions = JSON.parse(this.#sessions.trim());

      console.log(this.#sessions);
    } catch (e) {
      this.#sessions = {};
    }
  }

  #storeSessions() {
    fs.writeFileSync(
      "./sessions.json",
      JSON.stringify(this.#sessions),
      "utf-8"
    );
  }

  set(key, value) {
    if (!value) {
      value = {};
    }
    this.#sessions[key] = value;
    this.#storeSessions();
  }

  get(key) {
    return this.#sessions[key];
  }

  init(res) {
    const sessionId = uuid.v4();
    this.set(sessionId);

    return sessionId;
  }

  destroy(req, res) {
    const sessionId = req.sessionId;
    delete this.#sessions[sessionId];
    this.#storeSessions();
  }
}

const sessions = new Session();

app.use((req, res, next) => {
  let currentSession = {};
  let sessionId = req.get(SESSION_KEY);

  if (sessionId) {
    currentSession = sessions.get(sessionId);
    if (!currentSession) {
      currentSession = {};
      sessionId = sessions.init(res);
    }
  } else {
    sessionId = sessions.init(res);
  }
  req.session = currentSession;
  req.sessionId = sessionId;

  onFinished(req, () => {
    const currentSession = req.session;
    const sessionId = req.sessionId;
    sessions.set(sessionId, currentSession);
  });

  next();
});

app.get("/", (req, res) => {
  if (req.session.username) {
    return res.json({
      username: req.session.username,
      logout: "http://localhost:3000/logout",
    });
  }
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.get("/logout", (req, res) => {
  sessions.destroy(req, res);
  res.redirect("/");
});

app.post("/api/login", async (req, res) => {
  const { login, password } = req.body;

  try {
    const response = await axios.post(
      "https://dev-wge5woxnkc7b6nfj.eu.auth0.com/oauth/token",
      {
        grant_type: "password",
        username: login,
        password: password,
        audience: "https://dev-wge5woxnkc7b6nfj.eu.auth0.com/api/v2/",
        client_id: "vyO83Jg87vzzlaREqVPHiUsh9HJ9INAA",
        client_secret:
          "6TvMnor0ZvVBOpPOlKH65MCsvA8r_iMG1JFku4FHtHx0tNXLq5sT4AzcDRp2Pmg6",
      }
    );

    const { access_token } = response.data;
    req.session.accessToken = access_token;
    req.session.username = login;

    res.json({ token: req.sessionId });
  } catch (error) {
    res.status(401).send("Authentication failed");
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
