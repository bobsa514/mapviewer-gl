import type { FeatureCollection } from 'geojson';

export const sampleCities: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] }, properties: { name: 'San Francisco', state: 'CA', population: 873965 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] }, properties: { name: 'New York', state: 'NY', population: 8336817 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] }, properties: { name: 'Chicago', state: 'IL', population: 2693976 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.2437, 34.0522] }, properties: { name: 'Los Angeles', state: 'CA', population: 3898747 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-95.3698, 29.7604] }, properties: { name: 'Houston', state: 'TX', population: 2304580 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-112.074, 33.4484] }, properties: { name: 'Phoenix', state: 'AZ', population: 1608139 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-75.1652, 39.9526] }, properties: { name: 'Philadelphia', state: 'PA', population: 1603797 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-98.4936, 29.4241] }, properties: { name: 'San Antonio', state: 'TX', population: 1547253 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-117.1611, 32.7157] }, properties: { name: 'San Diego', state: 'CA', population: 1386932 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-96.797, 32.7767] }, properties: { name: 'Dallas', state: 'TX', population: 1304379 } },
  ]
};

export const sampleStates: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-104.05, 41.0], [-104.05, 45.0], [-111.05, 45.0], [-111.05, 41.0], [-104.05, 41.0]]]
      },
      properties: { name: 'Wyoming', abbreviation: 'WY', area_sq_mi: 97813 }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-102.05, 37.0], [-102.05, 41.0], [-109.05, 41.0], [-109.05, 37.0], [-102.05, 37.0]]]
      },
      properties: { name: 'Colorado', abbreviation: 'CO', area_sq_mi: 104094 }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-96.44, 28.0], [-96.44, 36.5], [-106.65, 36.5], [-106.65, 31.75], [-103.0, 31.75], [-103.0, 28.0], [-96.44, 28.0]]]
      },
      properties: { name: 'Texas', abbreviation: 'TX', area_sq_mi: 268596 }
    },
  ]
};
