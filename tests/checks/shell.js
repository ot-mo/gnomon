// The shell's spine: screens.js (mode stack and registry), keys.js (bindings, top screen first) and ui.js
// (the widget library). TECH_DESIGN §4.1, §4.3, §4.4 and the 0D1 scope.
//
//   checkShell({ game, startRun, inputHandlers, screens, keys, ui, input, S, capture, srcFiles }) → { name, ok, problems, stats }
//
//   1. The stack: pushMode remembers what to return to, popMode returns there with the result (onPop, leave),
//      never empties the stack; setMode replaces it; a mode set directly (game.mode = …, as checks and tools
//      do) is followed (over the view: pushed; lower in the stack: popped back to; opaque: the whole stack);
//      the pointer goes as each screen wants it ("unlock" / "lock" / "keep"); timeRuns.
//   2. Keys, through the game's real onKeyDown: a screen with a text field sees every key first, so "m",
//      "M", "Ö" and "å" type and M toggles no music; with no such screen M and N are "*" bindings (they log
//      their switch) in the views, rotate, transition, dead and won, not on auto-repeat (talk and the pack
//      take every key themselves: section 5). Order: the mode's bindings, then "play" (explore and map only), then "*"; a
//      handler returning false passes the key on; when; unbind; helpFor and keyLabel.
//   3. Widgets at 100×30: modal centres and clamps; box draws a full border (rules: only the top and bottom);
//      wrap; list scrolls to keep the selection in view, listKey (wrapping ↑↓, PgUp/PgDn, Home/End, select),
//      listWheel, listAt; tabs and tabsKey; bar; textInput (one printable character inserted at the cursor,
//      emoji as one, Shift/Dead/Tab/Enter keys not, the length cap, editing keys, done and cancel);
//      drawTextInput; keyHelp fits its width; hit-testing (the last rect drawn wins, beginFrame clears).
//   4. The game draws, updates and routes the mouse, hover and wheel to a registered top screen.
//      input-browser.js passes e.key.
export function checkShell({ game, startRun, inputHandlers, screens, keys, ui, input, S, capture, srcFiles }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // A pointer that counts what it's asked to do.
  const ptr = { locks: 0, unlocks: 0 };
  input.setInputBackend({ canLock: false, isLocked: () => true, lock() { ptr.locks++; }, unlock() { ptr.unlocks++; }, init() {} });

  startRun(4242);
  game.pages = null; game.mode = "map"; game.view = "map";

  // --- 1. The stack -------------------------------------------------------------------------------------
  {
    const log = [];
    screens.registerScreen("t:a", { draw() {}, enter: (g, d) => log.push(`enter a ${d?.n}`), leave: (g, r) => log.push(`leave a ${r}`) });
    screens.registerScreen("t:b", { draw() {}, pointer: "keep", enter: () => log.push("enter b"), leave: (g, r) => log.push(`leave b ${r}`) });
    screens.registerScreen("t:lock", { draw() {}, pointer: "lock", pausesTime: false });
    const def = screens.screenFor("t:a");
    if (def.pausesTime !== true || def.pointer !== "unlock" || def.over !== "view" || def.saveable !== false) fail(`defaults: ${JSON.stringify(def)}`);
    let popped = null;
    const u0 = ptr.unlocks;
    screens.pushMode(game, "t:a", { n: 1, onPop: (g, r) => { popped = r; } });
    if (ptr.unlocks !== u0 + 1) fail("pushing an \"unlock\" screen didn't unlock the pointer");
    screens.pushMode(game, "t:b");
    if (ptr.unlocks !== u0 + 1) fail("pushing a \"keep\" screen touched the pointer");
    if (game.mode !== "t:b" || screens.topMode(game) !== "t:b" || game.modeStack.length !== 3) fail(`after two pushes: ${game.mode}, stack ${game.modeStack.map((e) => e.mode)}`);
    screens.popMode(game, "x");
    if (game.mode !== "t:a" || screens.modeData(game)?.n !== 1) fail(`pop returned to ${game.mode}`);
    screens.popMode(game, "done");
    if (game.mode !== "map" || popped !== "done") fail(`second pop: mode ${game.mode}, onPop got ${popped}`);
    if (screens.popMode(game) !== false || game.mode !== "map" || game.modeStack.length !== 1) fail("popMode emptied the stack");
    if (log.join("|") !== "enter a 1|enter b|leave b x|leave a done") fail(`enter/leave order: ${log.join("|")}`);
    // Checks and tools set game.mode directly: the stack follows. A screen drawn over the view goes on top,
    // a mode lower in the stack pops back to it, an opaque one (a view) becomes the whole stack.
    screens.pushMode(game, "t:a");
    game.mode = "inventory";
    screens.popMode(game);
    if (game.mode !== "t:a") fail(`game.mode = "inventory" over t:a, then pop: went to ${game.mode}`);
    game.mode = "inventory";
    game.mode = "map";
    screens.syncStack(game);
    if (game.modeStack.map((e) => e.mode).join() !== "map") fail(`game.mode = "map" under two screens: stack ${game.modeStack.map((e) => e.mode)}`);
    game.mode = "explore";   // and an opaque mode replaces it
    screens.pushMode(game, "t:lock");
    game.paused = true;
    screens.popMode(game);
    if (game.mode !== "explore" || game.paused) fail(`pushed over explore, popped to ${game.mode} (paused ${game.paused}): explore locks the pointer and unpauses`);
    const l0 = ptr.locks;
    game.paused = true;
    screens.pushMode(game, "t:lock");
    if (ptr.locks !== l0 + 1 || game.paused) fail("a \"lock\" screen didn't lock the pointer and unpause");
    screens.setMode(game, "t:a", { n: 7 });
    if (game.mode !== "t:a" || game.modeStack.length !== 1 || screens.modeData(game).n !== 7) fail(`setMode: ${game.modeStack.map((e) => e.mode)}`);
    if (!screens.timeRuns({ mode: "t:lock" }) || screens.timeRuns({ mode: "t:a" }) || !screens.timeRuns({ mode: "explore" }) || screens.timeRuns({ mode: "inventory" })) fail("timeRuns");
    screens.setMode(game, "map");
    stats.stack = `push/pop/set, ${log.length} enter/leave calls, pointer ${ptr.locks} locks ${ptr.unlocks} unlocks`;
  }

  // --- 2. Keys -------------------------------------------------------------------------------------------
  {
    const said = (re) => game.messages.filter((m) => re.test(m.text)).length;
    const press = (code, key, repeat = false) => inputHandlers.onKeyDown(code, repeat, key);
    // A text field on top: every key types.
    const field = { text: "", max: 24 };
    let result = null;
    screens.registerScreen("t:name", {
      draw: () => ui.drawTextInput(2, 2, 20, field),
      key(g, code, repeat, key) { const r = ui.textInput(field, code, key); if (r) { result = r; screens.popMode(g, field.text); } return true; },
    });
    screens.pushMode(game, "t:name");
    const music0 = said(/^Music (on|off)/), sounds0 = said(/^Sounds and voices/);
    for (const [code, key] of [["KeyM", "m"], ["KeyM", "M"], ["Semicolon", "Ö"], ["BracketLeft", "å"], ["ShiftLeft", "Shift"], ["KeyN", "n"], ["Quote", "Dead"], ["Tab", "Tab"]])
      press(code, key);
    if (field.text !== "mMÖån") fail(`the name field holds "${field.text}", want "mMÖån"`);
    if (said(/^Music (on|off)/) !== music0 || said(/^Sounds and voices/) !== sounds0) fail("M or N toggled a switch while typing");
    press("Backspace", "Backspace");
    press("Enter", "Enter");
    if (result !== "done" || field.text !== "mMÖå" || game.mode !== "map") fail(`Enter: ${result}, "${field.text}", mode ${game.mode}`);
    stats.typed = `"${field.text}" (M and N typed, no switch toggled)`;

    // No text field: M and N are "*" bindings.
    press("KeyM", "m"); press("KeyM", "m");
    press("KeyN", "n"); press("KeyN", "n");
    if (said(/^Music (on|off)/) !== music0 + 2 || said(/^Sounds and voices/) !== sounds0 + 2) fail("M and N on the map didn't toggle music and sounds");
    if (keys.dispatchKey(game, "KeyM", true, "m")) fail("M on auto-repeat toggled the music");
    for (const mode of ["explore", "map", "dead", "won", "rotate", "transition"])   // screens that leave N to the "*" binding
      if (!keys.dispatchKey({ ...game, mode, log() {} }, "KeyN", false, "n")) fail(`N isn't global in ${mode}`);
    if (said(/^Music (on|off)/) !== music0 + 2) fail("M toggled during the mode sweep");

    // Order and options.
    const ran = [];
    const offs = [
      keys.bind("*", "KeyU", () => { ran.push("*"); }),
      keys.bind("play", "KeyU", () => { ran.push("play"); return false; }, { help: "test play" }),
      keys.bind("map", "KeyU", () => { ran.push("map"); return false; }, { help: "test map" }),
      keys.bind("map", ["KeyY", "Slash"], () => { ran.push("y"); }, { repeat: true, when: (g) => g.flagY }),
    ];
    keys.dispatchKey(game, "KeyU", false, "u");
    if (ran.join() !== "map,play,*") fail(`order on the map: ${ran.join()}`);
    ran.length = 0;
    keys.dispatchKey({ ...game, mode: "inventory" }, "KeyU", false, "u");
    if (ran.join() !== "*") fail(`"play" bindings ran in the inventory: ${ran.join()}`);
    ran.length = 0;
    if (keys.dispatchKey(game, "KeyY", false, "y") || ran.length) fail("a `when` binding ran while false");
    if (!keys.dispatchKey({ ...game, flagY: true }, "Slash", true, "/") || ran.join() !== "y") fail("a repeat binding with a list of codes didn't run");
    const help = keys.helpFor("map").map((h) => `${keys.keyLabel(h.code)} ${h.help}`);
    for (const want of ["U test map", "U test play", "M music", "N sounds"]) if (!help.includes(want)) fail(`helpFor("map") lacks "${want}": ${help.join(" · ")}`);
    if (keys.helpFor("inventory").some((h) => h.help === "test play")) fail("helpFor(\"inventory\") lists a \"play\" binding");
    for (const off of offs) off();
    ran.length = 0;
    keys.dispatchKey(game, "KeyU", false, "u");
    if (ran.length) fail(`unbind left ${ran.join()}`);
    const labels = ["KeyM", "Digit1", "Escape", "ArrowUp", "Numpad5", "Space"].map(keys.keyLabel).join(" ");
    if (labels !== "M 1 Esc ↑ 5 Space") fail(`keyLabel: ${labels}`);
    // A screen's key() that declines (false) lets the bindings have it.
    screens.registerScreen("t:decline", { draw() {}, key: () => false });
    screens.pushMode(game, "t:decline");
    const m1 = said(/^Music (on|off)/);
    press("KeyM", "m");
    if (said(/^Music (on|off)/) !== m1 + 1) fail("M under a screen that declines it didn't reach the \"*\" binding");
    press("KeyM", "m");
    screens.popMode(game);
    stats.keys = `${help.length} help entries on the map; order map → play → *`;
  }

  // --- 3. Widgets ----------------------------------------------------------------------------------------
  {
    if (S.cols !== 100 || S.rows !== 30) fail(`the check runs at ${S.cols}×${S.rows}, want 100×30`);
    const cell = (x, y) => capture.chars[y * capture.cols + x];
    const present = () => S.present();
    if (!eq(ui.modal(200, 50), { x0: 0, y0: 0, w: 100, h: 30 })) fail(`modal(200, 50): ${JSON.stringify(ui.modal(200, 50))}`);
    if (!eq(ui.modal(40, 10), { x0: 30, y0: 10, w: 40, h: 10 })) fail(`modal(40, 10): ${JSON.stringify(ui.modal(40, 10))}`);

    S.clear(); ui.box(10, 5, 20, 6, { title: "Pack" }); present();
    const corners = [cell(10, 5), cell(29, 5), cell(10, 10), cell(29, 10)].join(""), sides = cell(10, 7) + cell(29, 7);
    if (corners !== "++++" || sides !== "||" || cell(25, 5) !== "-" || cell(15, 10) !== "-") fail(`box border: corners "${corners}" sides "${sides}"`);
    if (capture.chars.slice(5 * 100 + 12, 5 * 100 + 18).join("") !== " Pack ") fail("box title");
    S.clear(); ui.box(10, 5, 20, 6, { rules: true }); present();
    if (cell(10, 7) !== " " || cell(10, 5) !== "-") fail("box with rules drew sides");

    const cases = [["a bb ccc dddd", 6, ["a bb", "ccc", "dddd"]], ["one\n\ntwo three", 20, ["one", "", "two three"]], ["longword x", 3, ["longword", "x"]]];
    for (const [t, w, want] of cases) if (!eq(ui.wrap(t, w), want)) fail(`wrap(${JSON.stringify(t)}, ${w}) = ${JSON.stringify(ui.wrap(t, w))}`);

    // A list of 50 in 10 rows.
    const items = Array.from({ length: 50 }, (_, k) => `item ${k}`), st = { sel: 0, top: 0 };
    const draw = () => { ui.beginFrame(); S.clear(); ui.list(st, { x: 5, y: 3, w: 30, h: 10, items }); present(); };
    draw();
    if (st.top !== 0 || cell(5, 3) !== ">" || cell(34, 12) !== "v") fail(`list at the top: top ${st.top}`);
    if (ui.listKey(st, "End", 50) !== "move" || st.sel !== 49) fail("End");
    draw();
    if (st.top !== 40 || cell(5, 12) !== ">" || cell(34, 3) !== "^") fail(`after End: top ${st.top}`);
    ui.listKey(st, "PageUp", 50);
    if (st.sel !== 39) fail(`PgUp from 49 by 10: ${st.sel}`);
    draw();
    if (st.top !== 39) fail(`after PgUp: top ${st.top}`);
    st.sel = 0; ui.listKey(st, "ArrowUp", 50);
    if (st.sel !== 49) fail("↑ from the first row doesn't wrap");
    ui.listKey(st, "KeyS", 50);
    if (st.sel !== 0) fail("S from the last row doesn't wrap");
    if (ui.listKey(st, "Enter", 50) !== "select" || ui.listKey(st, "KeyE", 50) !== "select" || ui.listKey(st, "KeyQ", 50) !== null) fail("listKey select / other");
    ui.listWheel(st, 1, 50); ui.listWheel(st, 1, 50);
    if (st.sel !== 2) fail(`two wheel steps: ${st.sel}`);
    st.top = 0;
    draw();
    if (ui.listAt(st, { x: 8, y: 6 }) !== 3 || ui.listAt(st, { x: 40, y: 6 }) !== -1 || ui.listAt({}, { x: 8, y: 6 }) !== -1) fail("listAt");
    S.clear(); ui.list({ sel: 3 }, { x: 0, y: 0, w: 20, h: 5, items: [], empty: "(nothing)" }); present();
    if (capture.chars.slice(2, 11).join("") !== "(nothing)") fail("an empty list's text");

    ui.beginFrame();
    const tw = ui.tabs(2, 1, ["buy", "sell", "services"], 1);
    if (tw !== "  buy  ".length + 1 + "[ SELL ]".length + 1 + "  services  ".length) fail(`tabs width ${tw}`);
    if (ui.at({ x: 10, y: 1 })?.tab !== 1 || ui.at({ x: 2, y: 1 })?.tab !== 0) fail("tabs hit-test");
    if (ui.tabsKey("Tab", 2, 3) !== 0 || ui.tabsKey("ArrowLeft", 0, 3) !== 2 || ui.tabsKey("ArrowRight", 0, 3) !== 1 || ui.tabsKey("KeyX", 0, 3) !== null) fail("tabsKey");

    S.clear(); ui.bar(0, 0, 20, 0.5, [200, 60, 60], "HP"); present();
    const barText = capture.chars.slice(0, 20).join("");
    if (barText !== "HP [########.......]") fail(`bar: "${barText}"`);

    // Text input.
    const t = { text: "", max: 6 };
    const type = (...ks) => ks.map(([code, key]) => ui.textInput(t, code, key));
    type(["KeyA", "a"], ["Semicolon", "Ö"], ["KeyM", "m"], ["Digit1", "😀"], ["ShiftLeft", "Shift"], ["Quote", "Dead"], ["Tab", "\t"], ["F5", "F5"]);
    if (t.text !== "aÖm😀" || t.cursor !== 4) fail(`typed "${t.text}" cursor ${t.cursor}`);
    type(["Backspace", "Backspace"]);
    if (t.text !== "aÖm") fail(`Backspace on an emoji left "${t.text}"`);
    type(["Home", "Home"], ["ArrowRight", "ArrowRight"], ["KeyX", "X"], ["Delete", "Delete"], ["End", "End"], ["KeyZ", "z"], ["KeyZ", "z"], ["KeyZ", "z"], ["KeyZ", "z"]);
    if (t.text !== "aXmzzz") fail(`editing in the middle and the cap of 6: "${t.text}"`);
    if (ui.textInput(t, "Enter", "Enter") !== "done" || ui.textInput(t, "Escape", "Escape") !== "cancel" || ui.textInput(t, "KeyQ", "q") !== null) fail("textInput results");
    S.clear(); ui.drawTextInput(0, 0, 10, { text: "Örn", cursor: 3 }); present();
    if (capture.chars.slice(0, 10).join("") !== "Örn_......") fail(`drawTextInput: "${capture.chars.slice(0, 10).join("")}"`);
    S.clear(); ui.drawTextInput(0, 0, 4, { text: "abcdefg", cursor: 7 }); present();
    if (capture.chars.slice(0, 4).join("") !== "efg_") fail(`a long field keeps the cursor in view: "${capture.chars.slice(0, 4).join("")}"`);

    const entries = [{ code: "ArrowUp", help: "move" }, { code: "ArrowDown", help: "move" }, { code: "Enter", help: "use" }, { code: "Escape", help: "back" }, { code: "KeyM", help: "music" }];
    S.clear(); const one = ui.keyHelp(0, 0, 100, entries); present();
    const line = capture.chars.slice(0, 100).join("").trimEnd();
    if (one !== 1 || line !== "↑/↓ move · Enter use · Esc back · M music") fail(`keyHelp: ${one} rows, "${line}"`);
    S.clear(); const rowsUsed = ui.keyHelp(0, 0, 16, entries); present();
    for (let y = 0; y < 30; y++) if (capture.chars.slice(y * 100 + 16, y * 100 + 100).some((c) => c !== " ")) fail(`keyHelp at width 16 spilled on row ${y}`);
    if (rowsUsed < 3) fail(`keyHelp at width 16 used ${rowsUsed} rows`);

    ui.beginFrame();
    ui.hit({ x: 0, y: 0, w: 10, h: 10 }, "under"); ui.hit({ x: 5, y: 5, w: 2, h: 2 }, "over");
    if (ui.at({ x: 5, y: 5 }) !== "over" || ui.at({ x: 1, y: 1 }) !== "under" || ui.at({ x: 10, y: 0 }) !== null || ui.at(null) !== null) fail("hit-test");
    ui.beginFrame();
    if (ui.at({ x: 1, y: 1 }) !== null) fail("beginFrame didn't clear the hits");
    stats.widgets = "modal, box, wrap, list, tabs, bar, textInput, keyHelp, hit-test at 100×30";
  }

  // --- 4. The game routes to a registered top screen -----------------------------------------------------
  {
    const got = [];
    let updates = 0;
    screens.registerScreen("t:top", {
      draw: () => { S.text(0, 29, "TOP-SCREEN"); ui.hit({ x: 0, y: 29, w: 10, h: 1 }, "top"); },
      update: () => { updates++; },
      mouse: (g, b, c) => got.push(`mouse ${b} ${c.x},${c.y} ${ui.at(c)}`),
      hover: (g, c) => got.push(`hover ${c.x},${c.y}`),
      wheel: (g, s) => got.push(`wheel ${s}`),
    });
    screens.registerScreen("t:under", { draw: () => S.text(0, 28, "UNDER-SCREEN") });
    screens.pushMode(game, "t:under");
    screens.pushMode(game, "t:top");
    game.debug.draw();
    const row = (y) => capture.chars.slice(y * 100, y * 100 + 12).join("");
    if (!row(29).startsWith("TOP-SCREEN") || !row(28).startsWith("UNDER-SCREEN")) fail(`the stack wasn't drawn bottom-up: "${row(28)}" / "${row(29)}"`);
    game.debug.step(0.016);
    if (updates !== 1) fail(`the top screen's update ran ${updates} times in a step`);
    const fov = game.fov;
    inputHandlers.onMouseDown(0, 3, 29);
    inputHandlers.onHover(4, 5);
    inputHandlers.onWheel(1);
    if (got.join("|") !== "mouse 0 3,29 top|hover 4,5|wheel 1") fail(`routed: ${got.join("|")}`);
    if (game.fov !== fov) fail("the wheel changed the field of view under a screen that took it");
    screens.setMode(game, "map");
    game.debug.draw();
    if (row(29).startsWith("TOP-SCREEN")) fail("a closed screen was still drawn");
    stats.routing = "draw (bottom-up), update, mouse, hover, wheel";
  }

  const ib = srcFiles.find((f) => f.file === "input-browser.js");
  if (!ib || !/onKeyDown\?\.\(e\.code, e\.repeat, e\.key\)/.test(ib.text)) fail("input-browser.js doesn't pass e.key to onKeyDown");

  return { name: "shell (screens, keys, ui)", ok: problems.length === 0, problems, stats };
}
