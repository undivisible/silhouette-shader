export const scenes = [
  { id: "bough", name: "Bough", description: "Leaves interrupt a clear window of light.", material: "Plaster / foliage" },
  { id: "slats", name: "Slats", description: "Fine bands of sun fall across a quiet wall.", material: "Plaster / timber" },
  { id: "spectrum", name: "Spectrum", description: "A glass edge separates light into colour.", material: "Glass / dispersion" },
  { id: "pendant", name: "Pendant", description: "Small hanging crystals scatter a moving constellation.", material: "Glass / refraction" },
  { id: "vault", name: "Vault", description: "An arched opening holds a pool of warmth.", material: "Terracotta / stone" },
  { id: "canopy", name: "Canopy", description: "A breeze opens bright spaces between leaves.", material: "Foliage / dapple" },
  { id: "shallows", name: "Shallows", description: "Intersecting ripples draw light beneath the water.", material: "Water / caustics" },
  { id: "rain", name: "Rain", description: "Droplets gather and bend a cool window of light.", material: "Rain / glass" },
  { id: "foil", name: "Foil", description: "A folded metal surface sends light back in ribbons.", material: "Copper / reflection" },
  { id: "opal", name: "Opal", description: "Translucent panes tint the light in pale colours.", material: "Glass / opalescence" },
  { id: "trellis", name: "Trellis", description: "An open lattice makes a shifting field of diamonds.", material: "Stone / lattice" },
  { id: "washi", name: "Washi", description: "Light softens through a timber and paper screen.", material: "Paper / timber" },
] as const;

export type SceneId = (typeof scenes)[number]["id"];
