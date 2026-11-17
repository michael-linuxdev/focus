// Redaktionelle Auswahl: welche Reihen der Überblick zeigt und welche Vergleiche er anbietet.
// Die Kennungen stammen aus dem Katalog von Dashboard Deutschland; fehlt eine, entfällt der Eintrag.

export interface SeriesRef {
  indicator: string;
  /** Name der Reihe wie in der Quelle. */
  series: string;
}

export interface Headline extends SeriesRef {
  label: string;
  /** Ersatz, falls die bevorzugte Reihe fehlt (z. B. GENESIS-Tabellen ohne Zugang). */
  fallback?: SeriesRef;
}

export const HEADLINES: Headline[] = [
  { label: "Wirtschaftsleistung (BIP)", indicator: "tile_1667811574092", series: "BIP kalender- und saisonbereinigt" },
  { label: "Verbraucherpreise", indicator: "genesis_61111-0002", series: "", fallback: { indicator: "tile_1684314533676", series: "Verbraucherpreisindex" } },
  { label: "Reallöhne", indicator: "genesis_62361-0001", series: "Reallohnindex", fallback: { indicator: "tile_1684314533676", series: "Insgesamt" } },
  { label: "Bevölkerung", indicator: "genesis_12411-0001", series: "" },
  { label: "Erwerbstätige", indicator: "tile_1667822587333", series: "saisonbereinigt" },
  { label: "Arbeitslose", indicator: "tile_1666958835081", series: "Arbeitslose" },
  { label: "Exporte", indicator: "tile_1667830902757", series: "Exporte" },
  { label: "ifo Geschäftsklima", indicator: "tile_1667288019608", series: "Geschäftsklima" },
  { label: "Super E10", indicator: "tile_1667921381760", series: "Super E10" },
  { label: "Füllstand Erdgasspeicher", indicator: "tile_1667227714015", series: "Füllstand" },
  { label: "Schulden des Bundes", indicator: "tile_1650978797816", series: "" },
];

export interface Preset {
  title: string;
  question: string;
  years: number;
  series: SeriesRef[];
}

export const PRESETS: Preset[] = [
  {
    title: "Löhne und Preise",
    question: "Steigen die Löhne schneller als die Verbraucherpreise?",
    years: 5,
    series: [
      { indicator: "genesis_62361-0001", series: "Nominallohnindex" },
      { indicator: "genesis_61111-0002", series: "" },
      { indicator: "genesis_62361-0001", series: "Reallohnindex" },
    ],
  },
  {
    title: "Arbeitslose und offene Stellen",
    question: "Wie eng ist der Arbeitsmarkt?",
    years: 10,
    series: [
      { indicator: "tile_1666958835081", series: "Arbeitslose" },
      { indicator: "tile_1666958835081", series: "gemeldete offene Stellen" },
    ],
  },
  {
    title: "Ölpreis und Tankstelle",
    question: "Wie schnell kommt der Rohölpreis an der Zapfsäule an?",
    years: 5,
    series: [
      { indicator: "tile_1667995478843", series: "Euro je Barrel" },
      { indicator: "tile_1667921381760", series: "Super E10" },
    ],
  },
  {
    title: "Stimmung und Wirtschaftsleistung",
    question: "Läuft das Geschäftsklima der Wirtschaftsleistung voraus?",
    years: 10,
    series: [
      { indicator: "tile_1667288019608", series: "Geschäftsklima" },
      { indicator: "tile_1667811574092", series: "BIP kalender- und saisonbereinigt" },
    ],
  },
  {
    title: "Zinsen und Hauspreise",
    question: "Was machen die Immobilienpreise, wenn die Renditen steigen?",
    years: 10,
    series: [
      { indicator: "data_umlaufrenditen_bundesanleihen", series: "10 Jahre" },
      { indicator: "tile_1656076602735", series: "Häuserpreisindex" },
    ],
  },
  {
    title: "Aufträge und Produktion",
    question: "Folgt die Industrieproduktion den Auftragseingängen?",
    years: 10,
    series: [
      { indicator: "tile_1667828024262", series: "Insgesamt" },
      { indicator: "tile_1667824915093", series: "Verarbeitendes Gewerbe" },
    ],
  },
];
