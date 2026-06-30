# F1 Fork — Product Strategy

> A Formula 1 fantasy prediction pool powered by a single AI commentator. Forked from the World Cup "Agente Mundial" product.

---

## Core Concept

A season-long F1 prediction game where users compete in **private groups (with friends)** or **public leagues (auto-matched)**. An AI bot roasts standings, analyzes strategy, and celebrates wins. The bot is the only voice in public leagues; private groups also have user-to-user chat.

---

## Game Modes

| | Private Group | Public League |
|---|---|---|
| **Access** | Admin invites by link | Auto-matched on signup |
| **Group size** | 8–12 | No cap (1 user = 1 league) |
| **Driver selection** | Snake draft (exclusive per group) | Budget system (non-exclusive) |
| **Chat** | User-to-user + bot | Bot only |
| **Admin** | Yes — manages group, pays or not | None |
| **Pricing** | $4.99/group pass (admin pays) | $4.99/season (individual) |

The same scoring engine and bot powers both modes. The difference is social dynamics and driver selection.

---

## Driver Selection

### Private — Snake Draft

- 8–12 players per group
- Drivers assigned in snake order (1→12, 12→1)
- Each driver can only be on one team per group
- 48h before first race, auto-draft fills missing picks
- Inactive players after 3 missed race windows → re-matched or ghost-filled

### Public — Budget System

- $100M budget per season
- Pick any 5 drivers + 2 constructors (duplicates allowed across users)
- Same budget for staff: team principal, engineers, mechanics
- Scales infinitely — no exclusivity needed

---

## Team Management (Public Only)

Part of the budget goes into "team staff" that modify your score:

| Role | Real-world metric | Effect |
|------|------------------|--------|
| **Team Principal** | Constructor's real finishing position | Multiplier on car upgrade effectiveness (×1.00–×1.15) |
| **Chief Engineer** | DHL Fastest Pit Stop ranking | Direct point bonus per race (+0 to +5) |
| **Mechanics** | Constructor reliability history | Reduces DNF penalty (1–8%) |
| **Car Development** | Same as constructor finishing position | ×1.00–×1.15 driver point multiplier |

The bot announces changes every race weekend:

> *"Ferrari brought upgrades to Silverstone — your ×1.12 car boost puts you 3 points ahead of the division average."*

---

## Scoring

```
Team Score = Σ Driver Points × Car Boost + Pit Stop Bonus + Constructor Points
```

Standard F1 fantasy scoring (qualifying + race position + fastest lap + overtakes). All modifiers are multipliers or flat bonuses layered on top.

---

## Pricing

### Free Tier
- Predictions + leaderboard
- Bot standings posts + race roasts
- Driver selection (draft or budget)
- Banner ads ($0.75 CPM blended)

### Premium — $4.99/season
- No ads
- **1:1 private bot chat** — users can @bot and get personalized responses
- Extra bot personalities (unlocked from base 4)
- Deeper stats (position delta charts, transfer history, head-to-head records)

The 1:1 private bot chat is the single premium hook. Free users see the bot broadcast to the league; premium users can also talk back to it.

---

## Engagement Loop

| Cadence | Trigger | Bot Action |
|---------|---------|------------|
| **Thursday** | Qualifying predictions open | "Quali predictions close in 24h — Alonso fans, your gamble..." |
| **Saturday** | Qualifying results | Post grid + roast qualifying predictions |
| **Saturday night** | Race predictions close | Bot picks a "bold prediction of the weekend" |
| **Sunday** | Race results | Post final standings + biggest movers + roast the backmarkers |
| **Between races** | Constructor market movers | "Red Bull's form is dropping — your car boost just went from ×1.12 to ×1.04" |

46 touchpoints over 23 race weekends. The bot drives every one.

---

## Infrastructure

Same self-hosted model as the World Cup product but with no user-to-user chat in public leagues:

| Cost (at 100k users) | Monthly |
|----------------------|---------|
| GPU inference (8B triage + judge) | $600–900 |
| Frontier inference (GPT-4o-mini, summaries) | $200–500 |
| Servers + networking | $500–900 |
| MongoDB | $600–1,000 |
| Monitoring | $300–800 |
| **Total (no HITL)** | **$2,200–3,500/mo** |

No HITL cost. No user-to-user chat means no moderation overhead. The bot is self-moderating.

---

## Key Differences from World Cup

| | World Cup | F1 Fork |
|---|---|---|
| **Duration** | 40 days | 10 months |
| **Engagement cadence** | Daily matches | Race weekends + quiet periods |
| **User-to-user chat** | Yes (private groups) | Yes private, No public |
| **Driver selection** | N/A (predictions) | Draft (private) / Budget (public) |
| **Team management** | N/A | Staff hiring + car upgrades |
| **HITL cost** | $5k–15k/mo | $0 (no moderation) |
| **Season pass** | $4.99/group | $4.99/group or $4.99/user |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| **Inter-race dropoff** — users forget between 2–4 week gaps | Bot still posts constructor updates, market movers, and "this week in F1 history" during off weeks |
| **Budget system feels less exciting than draft** | Public league is the acquisition funnel; private draft groups are the sticky product for power users |
| **10-month season is long** — churn accumulates | Mid-season reset (summer break = "transfer window" with fresh budget). Inactive users auto-replaced after 3 missed race windows |
| **Single constructors' real performance crashes** | If a team drops off (e.g., Alpine), their staff and car multipliers adjust naturally via real finishing positions |
