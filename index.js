const express = require("express");
const fs = require("fs");
const geolib = require("geolib");

const app = express();
const PORT = 3000;
app.use(express.json());

const isPointInBbox = (point, bbox) => {
  if (!point || !bbox) return false;

  const [lng, lat] = point;
  const [west, north, east, south] = bbox;

  if (lng < west || lng > east) return false;
  if (lat < north || lat > south) return false;

  return true;
};

const isPointInMultiPolygon = (point, coords) => {
  let result = false;
  if (!point || !coords) return result;

  const [longitude, latitude] = point;
  const libPoint = { latitude, longitude };

  coords.forEach((c0) => {
    c0.forEach((c1) => {
      const libPolygon = c1.map((c2) => ({
        latitude: c2[1],
        longitude: c2[0],
      }));

      if (geolib.isPointInPolygon(libPoint, libPolygon)) result = true;
    });
  });

  return result;
};

const handleGetPosition = (lat, lng) => {
  console.log(`coords: ${lat}, ${lng}`);
  let result = {
    status: "404",
    message: "Not Found",
  };
  if (!lat || !lng) return;
  const point = [lng, lat];

  const level1sBboxPath = `./data/gis/level1s_bbox.json`;
  const dataLevel1sBbox = fs.readFileSync(level1sBboxPath, "utf8");
  if (!dataLevel1sBbox) {
    result = {
      status: "500",
      message: "Internal Server Error",
    };
  }
  // Parse the JSON data
  const jsonData = JSON.parse(dataLevel1sBbox);
  // Process the JSON data as needed
  // Send a response, etc.
  const level1sBbox = jsonData;
  if (!level1sBbox) {
    result = {
      status: "500",
      message: "Internal Server Error",
    };
  }
  let existResult = false;
  Object.keys(level1sBbox).forEach(async (level1Id, index) => {
    if (existResult) return;
    const bbox = level1sBbox[level1Id];
    if (!isPointInBbox(point, bbox)) {
      return;
    }
    const jsonPath = `./data/gis/${level1Id}.json`;
    const dataJsonPath = fs.readFileSync(jsonPath, "utf8");
    const e1 = JSON.parse(dataJsonPath);
    const level2s = e1?.level2s;
    if (!Array.isArray(level2s)) {
      result = {
        status: "500",
        message: "Internal Server Error",
      };
    }
    console.log(`${e1.name}...`);

    level2s.forEach((level2) => {
      if (existResult) return;

      const coords =
        level2.type === "Polygon" ? [level2.coordinates] : level2.coordinates;
      if (isPointInMultiPolygon(point, coords)) {
        console.log(`${e1.name} - ${level2.name}`);
        result = {
          status: "200",
          message: {
            level1: e1.name,
            level2: level2.name,
          },
        };
      }
    });
  });
  return result;
};

app.post("/", (req, res) => {
  const { lat, lng } = req.body;

  // const level1sBbox = await fetch(level1sBboxPath).then(
  //   (r) => r.json(),
  //   (reason) => console.log(reason)
  // );
  const result = handleGetPosition(lat, lng);
  console.log("res: ", result);
  res.status(200).json(result);
});

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
