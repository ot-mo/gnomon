// The legacy campaign's story text: Hollowmere, the Temple of Angles, the Rotation Cube, and Vorlath
// the Lich King (the parent game's, moved here from story.js in 0A2; the temple itself is a plan now,
// content/world/temple.js).
//
// You start in the temple (the start landmark of the test world, over the legacy stack) seeing the
// world the only way anyone in Hollowmere ever has: flat, from above (the map view). On the altar of
// the lower sanctum lies the Rotation Cube. Touch it, and the world turns: the camera swings down into
// first person, and from then on Tab rotates you between the two ways of seeing.

export const LICH_COLOR = [140, 255, 170];

export const INTRO = [
  { title: "THE ROTATION CUBE", text: "In the village of Hollowmere, the world has always been flat.\n\nNot flat like a field. Flat like a drawing. North and south, east and west: that is all there is, and all there has ever been. When the people of Hollowmere look at the world, they see it the way you'd see a map: from above, all at once.\n\nThey have never once wondered what \"above\" means." },
  { text: "You are the youngest keeper of the Temple of Angles, the oldest building in the village.\n\nFor three nights now, something deep under the temple has been shaking the floor. Tonight the old priestess, Maren, has sent for you." },
  { title: "HOW TO PLAY", text: "You see the world from above, one step at a time. Nothing moves until you do.\n\nWASD or arrow keys: take a step. Walk into someone to talk, into a monster to fight, into a door or lever to use it.\nClick a tile: walk there.   Space: wait a moment (near spike traps: until their next beat).\nI: inventory.   J: journal.   M: music on/off.   N: sounds on/off.   Hover over anything to see what it is.\n\nMaren is in the main hall, just south of your room." },
];

export const CUBE_PAGES = [
  { text: "The cube turns in your hands, and the world turns with it.\n\nThe floor tilts away beneath you. The walls rise up, and up, and keep on rising. There is a direction you have never seen before. It goes UP.\n\nFor the first time in your life you are standing inside the world, instead of looking down on it." },
  { text: "Then, from very far below, a voice like dry pages turning:\n\n\"So. Someone has found the cube. A child of Hollowmere, no less. How quaint.\n\nI am Vorlath. I went to the bottom of the world and learned what your priests forgot: a world can be folded. Three into two. Two into one.\n\nHollowmere will make a lovely line.\"", color: LICH_COLOR },
  { title: "HOW TO PLAY: DEPTH", text: "Mouse: look around.   WASD: walk.   Shift: sprint.   Space: jump.\nLeft click: attack.   E: use, or talk.   T or right click: throw.   F: torch on/off.\n\nTab rotates between the two ways of seeing:\n  from above: the map. Turn by turn, the whole floor at once, and the flat things.\n  from inside: 3D. Height and depth, light and darkness, and the things that only show up close.\n\nYou'll need both. Maren will want to know what happened." },
];

// What Vorlath has to say as you go deeper (logged the first time you reach each floor).
export const TAUNTS = {
  1: "You step off the last stair into the dark below the temple. Somewhere far down, something is laughing.",
  5: "A voice like dry pages fills your head: \"Little keeper. Did you think the cube chose you? It chose the nearest pair of hands.\"",
  10: "\"Halfway down. Do you know what a line is, keeper? A village with no room left in it.\"",
  15: "\"I can feel my cube getting closer. Bring it to me. I'll make it quick: one dimension at a time.\"",
};

export const FINAL_PAGES = [
  { text: "The air down here is thin and strange, as if the world has been pressed flat between the pages of a book.\n\nSomewhere ahead, in a hall of pillars, a voice:\n\n\"Ah. The keeper. Come in, come in. And do bring my cube.\"", color: LICH_COLOR },
];

export const EPILOGUE = [
  { text: "Vorlath crumbles into a heap of very ordinary, very three-dimensional dust.\n\nFor a long moment the dungeon is silent. Then, far above you, a bird you have never heard before begins to sing." },
  { text: "You climb all twenty floors back up to the temple. Maren is waiting, and so is Hollowmere: flat as ever, and perfectly happy about it.\n\nNobody else in the village will ever see what you have seen. But on quiet evenings you take the cube down from its shelf, give it a little turn, and look up." },
  { title: "THE END", text: "Thank you for playing." },
];
