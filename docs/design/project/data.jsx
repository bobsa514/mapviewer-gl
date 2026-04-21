// Sample layers & mock data for the prototype

const PALETTES = {
  Reds:    ["#fee5d9","#fcae91","#fb6a4a","#de2d26","#a50f15"],
  Blues:   ["#eff3ff","#bdd7e7","#6baed6","#3182bd","#08519c"],
  Greens:  ["#edf8e9","#bae4b3","#74c476","#31a354","#006d2c"],
  Greys:   ["#f7f7f7","#cccccc","#969696","#636363","#252525"],
  YlGnBu:  ["#ffffcc","#a1dab4","#41b6c4","#2c7fb8","#253494"],
  YlOrRd:  ["#ffffb2","#fecc5c","#fd8d3c","#f03b20","#bd0026"],
  PuBuGn:  ["#f6eff7","#bdc9e1","#67a9cf","#1c9099","#016c59"],
  RdPu:    ["#feebe2","#fbb4b9","#f768a1","#c51b8a","#7a0177"],
};

const INITIAL_LAYERS = [
  {
    id: "cities",
    name: "US Major Cities",
    source: "CSV",
    geom: "point",
    visible: true,
    color: "#7c6aa8",
    opacity: 0.9,
    pointSize: 6,
    colorBy: { column: "population", palette: "PuBuGn", classes: 5 },
    sizeBy: null,
    filters: [],
    rowCount: 312,
    cols: ["name", "state", "population", "lat", "lng", "density"],
  },
  {
    id: "states",
    name: "US States",
    source: "GeoJSON",
    geom: "polygon",
    visible: true,
    color: "#c9c2dc",
    opacity: 0.35,
    colorBy: null,
    filters: [{ col: "region", op: "=", val: ["West","South"] }],
    rowCount: 50,
    cols: ["name", "abbr", "region", "pop_2020", "area_sqmi"],
  },
  {
    id: "census_ref",
    name: "census_reference",
    source: "Parquet",
    geom: null,
    sqlOnly: true,
    visible: false,
    rowCount: 84212,
    cols: ["tract_id","median_income","households","year"],
  },
];

const SAMPLES = [
  { id: "cities", title: "US Major Cities", desc: "312 points — population, density", type: "points" },
  { id: "states", title: "US States",       desc: "50 polygons — regional attributes", type: "polygons" },
];

// Generate deterministic point scatter for the "cities" layer across the CONUS-ish map box
function makeCityPoints(mapW, mapH) {
  const pts = [];
  const rng = (function(seed){ return function() { seed = (seed*9301+49297) % 233280; return seed/233280; }; })(42);
  const cities = [
    ["New York, NY", 0.78, 0.38, 8336817],
    ["Los Angeles, CA", 0.15, 0.55, 3979576],
    ["Chicago, IL", 0.58, 0.38, 2693976],
    ["Houston, TX", 0.48, 0.78, 2320268],
    ["Phoenix, AZ", 0.24, 0.60, 1680992],
    ["Philadelphia, PA", 0.76, 0.41, 1584064],
    ["San Antonio, TX", 0.44, 0.80, 1547253],
    ["San Diego, CA", 0.17, 0.62, 1423851],
    ["Dallas, TX", 0.49, 0.72, 1343573],
    ["Seattle, WA", 0.15, 0.18, 753675],
    ["Denver, CO", 0.36, 0.48, 727211],
    ["Boston, MA", 0.82, 0.32, 692600],
    ["Nashville, TN", 0.60, 0.58, 670820],
    ["Portland, OR", 0.14, 0.23, 654741],
    ["Miami, FL", 0.72, 0.88, 467963],
    ["Atlanta, GA", 0.65, 0.66, 498715],
    ["Minneapolis, MN", 0.52, 0.25, 429606],
    ["New Orleans, LA", 0.55, 0.82, 390144],
    ["Salt Lake City, UT", 0.27, 0.42, 200567],
    ["Kansas City, MO", 0.52, 0.52, 495327],
    ["St. Louis, MO", 0.57, 0.48, 300576],
    ["Indianapolis, IN", 0.60, 0.45, 876384],
    ["Charlotte, NC", 0.70, 0.60, 885708],
    ["Detroit, MI", 0.62, 0.32, 670031],
    ["Las Vegas, NV", 0.21, 0.52, 644644],
    ["Albuquerque, NM", 0.33, 0.62, 560513],
    ["Oklahoma City, OK", 0.47, 0.66, 655057],
    ["Memphis, TN", 0.57, 0.62, 633104],
    ["Milwaukee, WI", 0.57, 0.31, 577222],
  ];
  cities.forEach(([name, fx, fy, pop], i) => {
    pts.push({
      id: i,
      name, population: pop,
      density: Math.round(1000 + rng()*11000),
      state: name.split(", ")[1],
      lat: Math.round((50 - fy*26) * 100)/100,
      lng: Math.round((-125 + fx*58) * 100)/100,
      x: fx * mapW, y: fy * mapH,
    });
  });
  return pts;
}

Object.assign(window, { PALETTES, INITIAL_LAYERS, SAMPLES, makeCityPoints });
