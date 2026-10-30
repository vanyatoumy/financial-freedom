# Financial Freedom

A phone web app (PWA) to track income and spending with the 6-jars method from *Les secrets d'un esprit millionnaire*.
No dependencies and no build step. Data stays on the device (IndexedDB) and the app works offline.

## What it does (v1)
- **6 jars** (Nécessité 50 %, Investissement, Économie, Instruction, Amusement, Dons 10 % each). Every income is split automatically.
- **Wallets**: OM, MOMO, PAYSIKA, CASH, UBA (locked, holds Économie, ≈ +1.3 % every 6 months, only MOMO can send to it), Caisse (home box, holds Investissement).
- **Quick add** at any time: expense, income, withdrawal / deposit, move between jars. Also favourites (one tap from the home screen).
- **Mobile wallets (OM, MOMO, PAYSIKA)**: every operation can carry fees and taxes (paid from Nécessité). Allowed moves only: withdrawal OM/MOMO → CASH or PAYSIKA, PAYSIKA → OM/MOMO, deposit CASH → OM/MOMO, MOMO → UBA.
- **Fees & taxes report**: today, this month, this year or any period, by wallet and by operation.
- **Services for clients**: client money goes into a hidden "Argent clients" reserve (never income, never available); money advanced for a client is tracked as owed to me; closing a service turns only the margin (received − cost − fees) into income split over the 6 jars.
- **PAYSIKA one-step payment**: top-up + fee + expense in a single form. Subscription tracker with renewal alerts.
- **Morning count**: type what each wallet holds, then explain each gap (forgotten expense, fees, interest) or record it as an unexplained gap. Shows a day streak.
- **Loans and debts** with loan date, expected return date, partial repayments, interest, overdue alerts, and "forgive" (the rest becomes a gift paid from Dons).
- **Investments** (your association): money invested, payments received, return %, expected next payment, "no payment this time".
- **Dashboard**: available today, protected money, net worth, money not yet put in its home wallet, financial freedom %, monthly totals.
- **History** with filters, tap any operation to **edit** it (amount, date, wallet, jar, category, fees/taxes; income keeps its split proportions; undo available), **Settings** (percentages, wallets, categories), **CSV export**, **JSON backup and restore**.

## Run it on the computer
```bash
python -m http.server 8765
```
Then open http://localhost:8765.

## Install it on your phone
Live at **https://financial-freedom.vanyatoumy2.workers.dev** (Cloudflare, auto-deployed from GitHub on every push).

Installing as an app needs an HTTPS address. Free options:
1. **Netlify Drop**: go to https://app.netlify.com/drop and drag this folder onto the page. You get an `https://….netlify.app` link.
2. **GitHub Pages**: push this folder to a GitHub repository and turn on Pages.

On the phone, open the link in Chrome, then use **⋮ → Add to Home screen / Install app**.
Long-press the icon for shortcuts: *Dépense*, *Revenu*, *Comptage*.

> Your data lives only in that phone's browser. Use **Réglages → Sauvegarder** regularly, and keep the file somewhere safe (Drive, email to yourself).

## Code map
- `js/defaults.js`: jars, wallets, categories
- `js/logic.js`: money rules (split, balances, loans, investments, reminders). Amounts are stored in centimes.
- `js/store.js`: storage (IndexedDB)
- `js/views/*.js`: one file per screen
- `sw.js`: offline cache (bump `CACHE` when adding files)
