# Iron Forge sync: your own account on your own Mac

Status: plan, waiting for your yes. Nothing is built yet.

## What you get

- One account (a username and password you choose), held on your Mac, not by a company.
- The phone app and a Mac app sync with it. A new phone gets everything when you log in.
- The phone still works fully offline at the gym. It syncs when it can reach your Mac.

## The three pieces

1. **The server.** A small program on your Mac that holds your account and your data
   in one database file. Written for this app, using only what's built into Node
   (already on your Mac), so there are no new programs to install. (Last time I
   suggested PocketBase; this is simpler and does only what's needed.) It starts by
   itself when you log in to the Mac.
2. **Sync in the app.** Profile → Sync: the Mac's address, your login, a Sync now button
   and when it last synced. It also syncs by itself when the app opens, when you
   finish a workout and when you save a template.
3. **The Mac app.** The same Iron Forge code in a small Mac window. The window only ever
   shows Iron Forge; it can't open any other web page.

## How sync works

- Every workout, template, custom exercise, note, rest time, plan day and measurement
  records when it was last changed. Deleting something leaves a marker, so the other
  device deletes it too.
- Each device asks the server what has changed since it last synced, then sends its own
  changes.
- If the same thing was changed on both devices before syncing, the newer change wins.
  Workouts almost never clash, because each one is separate.
- PRs aren't sent across. Each device rebuilds them from the workouts; the app already
  has a function for this.

**Not synced:** the workout in progress, the rest timer, and sound and vibration
settings, which stay per device. Units (kg/lbs) do sync.

## Build order (about 4 to 5 days of work)

| # | Step | How it's tested | Time |
|---|------|-----------------|------|
| 1 | Server on the Mac: login, send/receive changes, database file, start at login, a daily copy of the database (keeps 7) | Requests sent to it directly | half a day |
| 2 | Sync in the app: change tracking, delete markers, the Sync screen, auto-sync | Two browser windows syncing with each other, like the testing today | 2 to 3 days |
| 3 | Phone: let the app talk to your Mac over Wi-Fi, then the first sync uploads all your existing data. **The app saves a full backup file first.** | On the HiBreak, only when you say | half a day |
| 4 | Mac app: the small window app | Open it, check your phone's workouts are there | half a day |
| 5 | Later, optional: sync away from home (Tailscale) | | an hour |

## Things that need your OK

- **A setting in the Android app that allows plain connections to your Mac.** Android
  blocks unencrypted connections by default. It means one slow native rebuild
  (about 15 minutes).
- **Tailscale, only if you want step 5.** It's a free private network between your own
  devices. You'd install it on the phone and the Mac yourself.
- No other new packages.

## Risks

- **Your Mac has to be on and awake to sync.** Until then, everything waits safely on
  the phone.
- **Your Mac's Wi-Fi address can change.** If it does, the app says "Can't reach your Mac"
  and you type the new address into Sync. Tailscale removes this problem.
- **Your Mac has about 3 GB free.** The server and the Mac app are small, but builds need room.

## Decisions for you (my picks first)

1. **Sync only on home Wi-Fi for now**, with Tailscale later. Or set up Tailscale from the start?
2. **The Mac app can log workouts too**, since it's the same app. Or make it view and plan only?
3. **Start the server automatically when you log in to the Mac.** Or start it by hand?
