// Music moods (TECH_DESIGN §1.2 music.js "mood by region", §2.18; WS3, then C1): which of music.js's moods
// plays where on the surface. Underground music.js keeps the parent game's choice by depth (dungeon, deep,
// boss). On the surface, the first of these that names a mood:
//   landmarks[zone.landmarkId]   a landmark's own (the Temple of Angles keeps the parent's temple mood)
//   the span's region `music`    (content/world/regions.js, C1a)
//   terrains[the span's terrain] the terrain's
//   surface                      anything else
// and at night (clock.js 19-05) `night` instead, unless the mood is one of `allNight` (a mood that is
// already the place's dark: the Shade's, a sanctum's). A name music.js doesn't know plays `surface`.
export const MOODS = {
  surface: "open",
  night: "night",
  allNight: ["shade", "temple", "lattice"],
  landmarks: { temple: "temple", hollowmere: "temple", halfnight: "temple", unlitChoir: "shade" },   // (Hollowmere: the Temple of Angles' start, as in the parent game)
  terrains: {
    // the real world (content/world/terrains.js)
    flats: "open", waste: "waste", steps: "open", downs: "open", pleatwood: "wood", deepPleat: "wood",
    tessellate: "open", stacks: "waste", shade: "shade", lattice: "lattice", teeth: "waste", sea: "shore", mere: "shore",
    river: "shore", road: "open",
    // the test world (content/world/test-world.js)
    hills: "open", forest: "wood", marsh: "shore", mountains: "waste",
  },
};
