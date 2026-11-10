const MAPS: Record<string, string> = {
  stadium_p: "DFH Stadium",
  stadium_day_p: "DFH Stadium (day)",
  stadium_foggy_p: "DFH Stadium (stormy)",
  eurostadium_p: "Mannfield",
  eurostadium_night_p: "Mannfield (night)",
  eurostadium_rainy_p: "Mannfield (stormy)",
  eurostadium_dusk_p: "Mannfield (dusk)",
  eurostadium_snownight_p: "Mannfield (snowy)",
  cs_p: "Champions Field",
  cs_day_p: "Champions Field (day)",
  cs_hw_p: "Rivals Arena",
  utopiastadium_p: "Utopia Coliseum",
  utopiastadium_dusk_p: "Utopia Coliseum (dusk)",
  utopiastadium_snow_p: "Utopia Coliseum (snowy)",
  trainstation_p: "Urban Central",
  trainstation_night_p: "Urban Central (night)",
  trainstation_dawn_p: "Urban Central (dawn)",
  park_p: "Beckwith Park",
  park_night_p: "Beckwith Park (midnight)",
  park_rainy_p: "Beckwith Park (stormy)",
  park_snowy_p: "Beckwith Park (snowy)",
  neotokyo_p: "Neo Tokyo",
  neotokyo_standard_p: "Neo Tokyo",
  beach_p: "Salty Shores",
  beach_night_p: "Salty Shores (night)",
  farm_p: "Farmstead",
  farm_night_p: "Farmstead (night)",
  farm_upsidedown_p: "Farmstead (the upside down)",
  chn_stadium_p: "Forbidden Temple",
  chn_stadium_day_p: "Forbidden Temple (day)",
  wasteland_p: "Wasteland",
  wasteland_night_p: "Wasteland (night)",
  wasteland_s_p: "Wasteland",
  arc_p: "Starbase ARC",
  arc_standard_p: "Starbase ARC",
  throwbackstadium_p: "Throwback Stadium",
  aquadome_p: "Aquadome",
  aquadome_night_p: "Aquadome",
  street_p: "Sovereign Heights",
  woods_p: "Drift Woods",
  outlaw_p: "Outlaw",
  stadium_10_p: "DFH Stadium",
  ff_stadium_p: "Estadio Vida",
  ff_dusk_p: "Estadio Vida (dusk)",
  underpass_p: "Underpass",
  labs_circlepillars_p: "Pillars",
  labs_cosmic_p: "Cosmic",
  labs_doublegoal_p: "Double Goal",
  labs_octagon_p: "Octagon",
  labs_underpass_p: "Underpass",
  labs_utopia_p: "Utopia Retro",
  hoopsstadium_p: "Dunk House",
  shattershot_p: "Core 707",
  throwbackhockey_p: "Throwback Stadium (snow day)",
};

export function mapLabel(internal: string | null | undefined): string {
  if (!internal) return "Unknown map";
  const key = internal.trim().toLowerCase();
  if (MAPS[key]) return MAPS[key];
  const pretty = internal
    .replace(/_P$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!pretty) return "Unknown map";
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function playlistLabel(playlist: string): string {
  switch (playlist) {
    case "duel":
      return "Duel";
    case "doubles":
      return "Doubles";
    case "standard":
      return "Standard";
    case "extra":
      return "Extra mode";
    default:
      return "Unknown mode";
  }
}
