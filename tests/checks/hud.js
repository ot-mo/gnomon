// The HUD and the map's registries (TECH_DESIGN §4.5, §2 R2, the 0D1 scope and gate).
//
//   checkHud({ game, startRun, inputHandlers, hud, renderMap, events, status, zones, S, capture, resize }) → { name, ok, problems, stats }
//
//   1. Segments: every Phase 0 segment is registered (location, HP, statuses, funds, level/XP, STR, AV/DV,
//      keys, torch, ready throwable, fps) with the priorities §4.5 gives. With all of them showing and
//      every status on, at 100×30 the status line takes one row, each segment drawn is whole and inside the
//      screen, what's dropped has a lower priority than location, HP and the statuses (never dropped), and
//      dropping is by priority (nothing dropped outranks something shown, unless it alone wouldn't fit). At
//      100×40 it takes two rows and drops nothing, and the map starts under them. At 180×56 the parent's
//      single row is unchanged (segments in the parent's order, two cells apart, fps at the right).
//   2. Toasts: walking off an open edge toasts the new zone's name under the status line for 2 s of real
//      time (also on the map, where game time stands still), and no log line says it; stairs (with the
//      "DEPTH n" beat) don't toast.
//   3. Overlays and describers: the map's layers and the inspect line's parts are registered in order;
//      a registered overlay draws over the tiles, a registered describer adds its part, and both can be
//      replaced. Drawing the map and describing every tile leaves the game's state as it was (pure).
//   4. Hover: a hover held still on a seen tile of the map for 0.5 s (real time, through the game's real
//      onHover and step) emits one `inspect` { zone, x, y, z, item?, creature?, open: false }; moving
//      on starts again; an unseen tile, the 3D view and a screen over the map emit nothing.
export function checkHud({ game, startRun, inputHandlers, hud, renderMap, events, status, zones, S, capture, resize }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const rowText = (y) => capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join("");

  const fresh = (seed = 7) => {
    startRun(seed);
    game.pages = null; game.mode = "map"; game.view = "map"; game.story.cube = true; game.modeStack = [];
    game.fps = 60; game.frameMs = 1.5;
  };
  const everything = () => {
    const p = game.player;
    for (const id of ["flying", "hasted", "shadowed", "poisoned", "darkened", "burning", "blinded"]) status.addStatus(game, p, id, { t: 30 });
    p.torch = true; p.keys = 3;
  };

  // --- 1. Segments ------------------------------------------------------------------------------------
  {
    const want = { location: 100, hp: 100, statuses: 90, funds: 60, level: 50, strength: 50, defence: 50, keys: 45, torch: 40, ready: 40, fps: 0 };
    const ids = hud.hudSegments();
    for (const [id, pr] of Object.entries(want)) {
      const seg = hud.segmentDef(id);
      if (!seg) fail(`segment "${id}" isn't registered`);
      else if (seg.priority !== pr) fail(`segment "${id}": priority ${seg.priority}, §4.5 says ${pr}`);
    }
    stats.segments = ids.length;

    const sizes = {};
    for (const [cols, rows] of [[100, 30], [100, 40], [180, 56], [80, 25]]) {
      resize(cols, rows);
      fresh();
      everything();
      for (const view of ["map", "3d"]) {
        game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = true;
        const L = hud.layoutHud(game);
        S.clear(); game.debug.draw();
        const y0 = view === "map" ? 1 : 0;
        const shown = L.rows.flat();
        for (const [k, row] of L.rows.entries()) {
          const text = rowText(y0 + k);
          for (const q of row) {
            if (q.x < 1 || q.x + q.text.length > cols - 1) fail(`${cols}×${rows} ${view}: "${q.text}" runs off the screen (x ${q.x})`);
            if (text.slice(q.x, q.x + q.text.length) !== q.text) fail(`${cols}×${rows} ${view}: "${q.text}" isn't drawn whole on row ${y0 + k}: "${text.trim()}"`);
          }
          for (let j = 1; j < row.length; j++) if (row[j].x < row[j - 1].x + row[j - 1].text.length + 1) fail(`${cols}×${rows} ${view}: "${row[j].text}" overlaps "${row[j - 1].text}"`);
        }
        const shownIds = new Set(shown.map((q) => q.id));
        for (const id of ["location", "hp", "statuses"]) if (!shownIds.has(id)) fail(`${cols}×${rows} ${view}: "${id}" was dropped`);
        const dropped = L.dropped.map(hud.segmentDef);
        for (const d of dropped) for (const s of [...shownIds].map(hud.segmentDef))
          if (d.priority > s.priority && s.align !== "right") {   // (fps takes what room is left over)
            const w = [d.parts(game, game.player)].flat().filter(Boolean).reduce((n, q) => n + q.text.length + 2, 0);
            if (w <= cols - 2) fail(`${cols}×${rows} ${view}: "${d.id}" (${d.priority}) dropped while "${s.id}" (${s.priority}) shows`);
          }
        if (rows < 40 && L.rows.length !== 1) fail(`${cols}×${rows} ${view}: ${L.rows.length} rows on a screen under 40 rows`);
        if (view === "map" && renderMap.mapView.top !== 1 + L.rows.length) fail(`${cols}×${rows}: the map starts on row ${renderMap.mapView.top}, under ${L.rows.length} HUD rows`);
        sizes[`${cols}x${rows} ${view}`] = { rows: L.rows.length, dropped: L.dropped.length };
      }
      // Three statuses (a busy moment): two rows at 100×40 hold everything.
      for (const id of ["shadowed", "darkened", "burning", "blinded"]) status.removeStatus(game, game.player, id);
      if (cols === 100 && rows === 40) {
        game.view = "3d"; game.mode = "explore";
        const L = hud.layoutHud(game);
        if (L.rows.length !== 2 || L.dropped.length) fail(`100×40, three statuses: ${L.rows.length} rows, dropped ${L.dropped}`);
      }
      // The parent's single row, unchanged where it fits: the segments in its order, two cells apart.
      if (cols === 180) {
        game.view = "3d"; game.mode = "explore";
        const L = hud.layoutHud(game), row = L.rows[0];
        const order = row.map((q) => q.id).filter((id, k, a) => a.indexOf(id) === k).join();
        if (L.rows.length !== 1 || order !== "location,hp,level,strength,defence,funds,keys,torch,ready,statuses,fps") fail(`180×56: one row in the parent's order, got ${L.rows.length} rows: ${order}`);
        for (let j = 1; j < row.length - 1; j++) if (row[j].x !== row[j - 1].x + row[j - 1].text.length + 2) fail(`180×56: "${row[j].text}" isn't two cells after "${row[j - 1].text}"`);
        const fps = row[row.length - 1];
        if (fps.id !== "fps" || fps.x + fps.text.length !== 179) fail(`180×56: fps isn't at the right end (${JSON.stringify(fps)})`);
      }
    }
    stats.layout = sizes;
    resize(100, 30);

    // Ordinary states, not only everything on: 0-7 statuses (every subset), keys on and off, levels 1-20,
    // both views, at 100×30. Nothing dropped outranks something shown (unless it alone wouldn't fit), and
    // `dropped` lists only segments with something to show.
    const all = ["flying", "hasted", "shadowed", "poisoned", "darkened", "burning", "blinded"];
    let layouts = 0, inversions = 0;
    const firstBad = [];
    for (let mask = 0; mask < 1 << all.length; mask++)
      for (const keys of [0, 3])
        for (const level of [1, 9, 20]) {
          if ((mask + keys + level) % 3 && mask % 7) continue;   // a spread, not the full product
          fresh();
          const p = game.player;
          all.forEach((id, k) => { if (mask & (1 << k)) status.addStatus(game, p, id, { t: 30 }); });
          p.keys = keys; p.level = level; p.xp = level * 38;
          for (const view of ["map", "3d"]) {
            game.view = view; game.mode = view === "map" ? "map" : "explore";
            const L = hud.layoutHud(game, 100, 30);
            layouts++;
            const shownIds = new Set(L.rows.flat().map((q) => q.id));
            for (const id of L.dropped) {
              const d = hud.segmentDef(id), parts = [d.parts(game, p)].flat().filter((q) => q && q.text);
              if (!parts.length) { inversions++; if (firstBad.length < 3) firstBad.push(`"${id}" listed as dropped with nothing to show`); continue; }
              const w = parts.reduce((n, q) => n + q.text.length + 2, 0);
              for (const s of [...shownIds].map(hud.segmentDef))
                if (d.priority > s.priority && s.align !== "right" && w <= 98) {
                  inversions++;
                  if (firstBad.length < 3) firstBad.push(`"${id}" (${d.priority}) dropped while "${s.id}" (${s.priority}) shows (statuses ${mask.toString(2)}, keys ${keys}, level ${level}, ${view})`);
                }
            }
          }
        }
    // The pause card at 100×30: its key-help line goes onto more rows inside the card, nothing cut off; at
    // 180×56 it stays one row, as in the parent.
    const help = "E use / talk · I inventory · J journal · T / right-click throw · Q quick-heal · R swap weapons · F torch · M music · N sounds";
    for (const [cols, rows] of [[100, 30], [180, 56]]) {
      resize(cols, rows);
      fresh();
      game.view = "3d"; game.mode = "explore"; game.modeStack = [];
      inputHandlers.onLockChange(false);
      S.clear(); game.debug.draw();
      const screen = Array.from({ length: rows }, (_, y) => rowText(y));
      const top = screen.findIndex((r) => /-{20,}/.test(r)), x0 = screen[top]?.indexOf("-"), x1 = screen[top]?.lastIndexOf("-");
      if (game.mode !== "pause" || top < 0) { fail(`${cols}×${rows}: no pause card`); continue; }
      for (const part of help.split(" · ")) {
        const y = screen.findIndex((r) => r.includes(part));
        const x = y >= 0 ? screen[y].indexOf(part) : -1;
        if (y < 0 || x < x0 + 1 || x + part.length > x1) fail(`${cols}×${rows}: the pause card's "${part}" is cut off or outside the card`);
      }
      if (cols === 180 && !screen.some((r) => r.includes(help))) fail("180×56: the pause card's key help isn't one row any more");
    }
    resize(100, 30);
    if (inversions) fail(`100×30, ordinary states: ${inversions} priority inversion(s) in ${layouts} layouts, e.g. ${firstBad.join("; ")}`);
    stats.sweep = `${layouts} layouts at 100×30, ${inversions} inversions`;
  }

  // --- 2. Toasts ----------------------------------------------------------------------------------------
  {
    fresh();
    const z0 = game.zone;
    const side = ["e", "s", "w", "n"].find((s) => z0.edges[s]);
    const p = game.player;
    const y = z0.d >> 1, x = z0.w >> 1;
    const logged = game.messages.length;
    const ok = side && zones.tryWalkOff(game, side, side === "e" || side === "w" ? y : x, { fromStand: Math.round(p.z), keepMotion: false });
    const name = game.zone.name;
    if (!ok || game.zone === z0) fail(`no open edge to walk off from ${z0.key}`);
    else {
      if (game.messages.slice(logged).some((m) => m.text === name)) fail("the zone's name was logged as well as toasted");
      game.mode = "map"; game.view = "map";
      const t0 = game.time;
      const seen = (y) => rowText(y).includes(name);
      game.debug.step(0.5); game.debug.draw();
      const L = hud.layoutHud(game), ty = 1 + L.rows.length + 1;
      if (!seen(ty)) fail(`no toast "${name}" on row ${ty} after the edge: "${rowText(ty).trim()}"`);
      game.debug.step(1.0); game.debug.draw();
      if (!seen(ty)) fail("the toast went before 2 s");
      game.debug.step(0.6); game.debug.draw();
      if (seen(ty)) fail("the toast is still there after 2.1 s");
      if (game.time !== t0) fail("game time ran on the map while the toast showed");
      stats.toast = { zone: game.zone.key, name, row: ty };
    }
    const toasts = game.toasts.length;
    game.debug.changeFloor(`${game.zone.wx},${game.zone.wy},-1`, "down", "");
    if (game.zone.z === -1 && game.toasts.length !== toasts && game.toasts.at(-1).text === game.zone.name) fail("going down the stairs toasted the name (the \"DEPTH n\" beat says it)");
  }

  // --- 3. Overlays and describers -----------------------------------------------------------------------
  {
    fresh();
    const want = ["slam", "items", "markers", "route", "areas", "damage", "people", "sightings", "you"];
    if (renderMap.mapOverlays().join() !== want.join()) fail(`overlays: ${renderMap.mapOverlays()}`);
    if (renderMap.describers().join() !== "tile,people,items,sightings,markers") fail(`describers: ${renderMap.describers()}`);
    const z = game.zone, p = game.player, tx = Math.floor(p.x), ty = Math.floor(p.y);
    z.seen[tx + ty * z.w] = 1;
    let drew = 0;
    renderMap.registerMapOverlay("t:mark", (g, v) => { drew++; const [sx, sy] = v.toScreen(tx, ty); S.put(sx, sy, "Z", 1, 2, 3); }, { order: 95 });
    renderMap.registerDescriber("t:say", (g, t) => (t.x === tx && t.y === ty ? "Test part." : null), { order: 5 });
    renderMap.mapView.hover = null;
    game.debug.draw();
    const top = renderMap.mapView.top;
    const sx = (tx - renderMap.mapView.tx0) * 2, sy = top + ty - renderMap.mapView.ty0;
    if (drew !== 1 || capture.chars[sy * capture.cols + sx] !== "Z") fail(`a registered overlay at order 95 didn't draw over "@" (drew ${drew}, "${capture.chars[sy * capture.cols + sx]}")`);
    const line = renderMap.describeTile(game, { x: tx, y: ty });
    if (!line.startsWith("Test part. ")) fail(`a describer at order 5 didn't lead the inspect line: "${line}"`);
    renderMap.registerMapOverlay("t:mark", () => {}, { order: 95 });   // replaced: draws nothing
    renderMap.registerDescriber("t:say", () => null, { order: 5 });
    game.debug.draw();
    if (capture.chars[sy * capture.cols + sx] !== "@" || renderMap.describeTile(game, { x: tx, y: ty }).startsWith("Test")) fail("re-registering an overlay or describer didn't replace it");
    // Pure: drawing and describing every tile changes nothing.
    const stateOf = () => JSON.stringify({ t: game.time, ui: game.uiTime, p: [p.x, p.y, p.z, p.yaw, p.hp], msgs: game.messages.length, travel: game.travel,
      seen: z.seen.reduce((n, v, i) => (n + v * (i % 9973)) % 1e9, 0), items: z.items.map((it) => [it.x, it.y, it.kind]),
      cr: z.creatures.map((c) => [c.id, c.x, c.y, c.hp, c.state]), mk: z.markers, sight: [...z.sightings.keys()] });
    const before = stateOf();
    let described = 0;
    for (let y = -1; y <= z.d; y++) for (let x = -1; x <= z.w; x++) { renderMap.describeTile(game, { x, y }); described++; }
    for (let k = 0; k < 40; k++) { renderMap.mapView.hover = { x: (k * 7) % S.cols, y: 2 + ((k * 5) % (S.rows - 3)) }; renderMap.renderMap(game); }
    renderMap.mapView.hover = null;
    if (stateOf() !== before) fail("drawing the map or describing tiles changed the game's state");
    stats.pure = { described, drawn: 40 };
  }

  // --- 4. The hover's `inspect` ----------------------------------------------------------------------------
  {
    fresh();
    const z = game.zone, p = game.player;
    const got = [];
    const off = events.on("inspect", (g, e) => got.push(e));
    // An item on a seen tile next to you, under the pointer.
    const tx = Math.floor(p.x) + 1, ty = Math.floor(p.y);
    z.seen[tx + ty * z.w] = 1; z.seen[tx - 1 + ty * z.w] = 1;
    z.items.push({ kind: "knife", x: tx + 0.5, y: ty + 0.5, z: p.z, count: 1 });
    game.debug.draw();
    const cellOf = (x, y) => ({ x: (x - renderMap.mapView.tx0) * 2, y: renderMap.mapView.top + y - renderMap.mapView.ty0 });
    const hoverAt = (c) => inputHandlers.onHover(c.x + 0.5, c.y + 0.5)   // (node-env: pointer positions are cells);
    hoverAt(cellOf(tx, ty));
    for (let k = 0; k < 4; k++) game.debug.step(0.1);
    if (got.length) fail(`inspect after 0.4 s of hover (${got.length})`);
    game.debug.step(0.15);
    if (got.length !== 1) fail(`${got.length} inspect events after 0.55 s of hover (want 1)`);
    else {
      const e = got[0];
      if (e.zone !== z || e.x !== tx || e.y !== ty || e.open !== false || typeof e.z !== "number" || e.item?.kind !== "knife") fail(`inspect payload: ${JSON.stringify({ ...e, zone: e.zone?.key })}`);
    }
    for (let k = 0; k < 20; k++) game.debug.step(0.1);
    if (got.length !== 1) fail(`holding on for 2 s more emitted ${got.length - 1} more`);
    hoverAt(cellOf(tx - 1, ty));   // you: a new tile starts again
    for (let k = 0; k < 6; k++) game.debug.step(0.1);
    if (got.length !== 2 || got[1].x !== tx - 1) fail(`moving to the next tile: ${got.length} events`);
    // An unseen tile emits nothing; nor does the 3D view; nor the map under the inventory.
    const unseen = [...z.seen.keys()].find((i) => !z.seen[i]);
    if (unseen !== undefined) {
      const ux = unseen % z.w, uy = Math.floor(unseen / z.w);
      renderMap.mapView.panX = 0; renderMap.mapView.panY = 0;
      const c = cellOf(ux, uy);
      if (c.y >= renderMap.mapView.top && c.y < S.rows - 2 && c.x < S.cols) {
        hoverAt(c);
        for (let k = 0; k < 8; k++) game.debug.step(0.1);
        if (got.length !== 2) fail("an unseen tile was inspected");
      }
    }
    hoverAt(cellOf(tx, ty));
    game.debug.openInv();
    for (let k = 0; k < 8; k++) game.debug.step(0.1);
    if (got.length !== 2) fail("a hover under the inventory was inspected");
    game.mode = "map"; game.modeStack = [];
    game.view = "3d"; game.mode = "explore"; game.paused = true;
    for (let k = 0; k < 8; k++) game.debug.step(0.1);
    if (got.length !== 2) fail("a hover in 3D was inspected");
    off();
    stats.inspect = { events: got.length, payload: got[0] && { x: got[0].x, y: got[0].y, z: got[0].z, item: got[0].item?.kind, open: got[0].open } };
  }

  return { name: "hud (segments, toasts, map overlays, inspect)", ok: problems.length === 0, problems, stats };
}
