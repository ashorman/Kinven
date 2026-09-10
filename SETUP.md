# Kinven setup

Kinven is a local-first task and calendar app. Your tasks stay in this browser; GitHub is only for the source code.

## 1. Run the app

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
cd ~/Kinven\ Local
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app |
| `npm test` | Run regression tests |
| `npm run build` | Production build |

Data is stored in the browser under `kinven-local-v1`. Nothing is sent to a server.

## 2. Connect your personal GitHub in Cursor

This step is already done on this machine:

**Cursor Settings → Integrations → Source Control → GitHub**  
Connected as **ashorman**.

That login lets Cursor create and push repos under `ashorman`. It does not by itself put this folder on GitHub. The next section does that.

If you set this up on a new computer:

1. Open Cursor Settings → Integrations.
2. Next to Source Control, choose **Add Provider → GitHub**.
3. Sign in as **ashorman** and allow access.
4. Confirm the card says `Connect as ashorman`.

## 3. Put this project on GitHub

From the project folder:

```bash
cd ~/Kinven\ Local
git remote -v
```

If you already see `origin` pointing at `github.com/ashorman/...`, you are done. Push later with:

```bash
git add -A
git commit -m "Your message"
git push
```

If there is no `origin` yet, create the repo once (GitHub CLI must be signed in as ashorman):

```bash
gh auth status
gh repo create kinven --private --source=. --remote=origin --push
```

After that, the code lives at **https://github.com/ashorman/Kinven**.

To clone it onto another machine:

```bash
gh repo clone ashorman/Kinven
cd kinven
npm install
npm run dev
```

## 4. Two different “GitHubs”

| Connection | What it is for |
| --- | --- |
| Cursor Integrations → GitHub as **ashorman** | Your personal account. Use this for Kinven. |
| Spotify / GitHub Enterprise | Work repos. Do not push Kinven there. |

If `git push` asks you to log in, use **ashorman**, not your work account.
