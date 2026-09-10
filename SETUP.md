# Kinven setup

Kinven runs on your computer. GitHub stores the code; it does not host a live app.

## 1. Run the app

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/ashorman/Kinven.git
cd Kinven
npm install
npm run dev
```

When the server starts, the terminal shows a URL such as `http://127.0.0.1:5173`. Open it in a browser on **this** machine. That address is loopback (localhost). It is not a public site, and it will not work for other people on the internet.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app locally |
| `npm test` | Run regression tests |
| `npm run build` | Production build |

Data stays in this browser under `kinven-local-v1`. Nothing is sent to a server.

## 2. Connect your personal GitHub in Cursor

Use this when you want Cursor to talk to **github.com/ashorman**, not a work GitHub.

1. Open Cursor Settings → Integrations.
2. Next to Source Control, choose **Add Provider → GitHub**.
3. Sign in as **ashorman** and allow access.
4. Confirm the card says `Connect as ashorman`.

That login is for Cursor. Git still needs `gh auth login --hostname github.com` (or a personal access token) before `git push` works.

## 3. Save changes to this repo

This project’s remote is already **https://github.com/ashorman/Kinven**.

```bash
git add -A
git commit -m "Your message"
git push
```

GitHub Enterprise at Spotify is a different account. Do not push Kinven there.

If `git push` asks for a password, GitHub will reject it. Use `gh auth login --hostname github.com --web` or a personal access token as the password, signed in as **ashorman**.
