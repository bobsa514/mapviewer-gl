# Geospatial Viewer

A modern, lightweight, interactive web-based geospatial data viewer built with React and deck.gl. View and analyze GeoJSON and CSV data with customizable styling options.

🌍 [Live Demo](https://bobsa514.github.io/geospatial-viewer/)

## Important Notes

### Data Storage
- **No Data Storage**: Please note that this tool does not store any data on the server. All data processing occurs locally on the user's machine. Once the session is closed, any uploaded data will be lost. This design ensures user privacy and data security.

### Mapbox Token
- **Environment Configuration**: It is crucial to change the `.env` file in your project directory to include your own Mapbox token. This is important because using my token may lead to it being maxed out due to usage limits. 
- To set your token, open the `.env` file and replace the placeholder with your own Mapbox access token:
  ```plaintext
  VITE_MAPBOX_TOKEN=your_mapbox_token_here
  ```

## Features

- 📍 Support for multiple data formats:
  - GeoJSON files for polygon/line/point data
  - CSV files with coordinate data (auto-detects lat/long columns)
- 🎨 Interactive styling options:
  - Color picker for layers
  - Opacity control
  - Point size adjustment for CSV data
- 👁️ Layer management:
  - Toggle layer visibility
  - Collapsible layer panel
  - Customizable symbology
  - Data filtering capabilities
- 🗺️ Map features:
  - Multiple base map options (Light, Dark, City, Satellite)
  - Interactive feature selection
  - Customizable property display
  - Automatic viewport fitting to data
- 🔍 Data exploration:
  - Feature property inspection
  - Column selection for display
  - Advanced filtering options

## Usage
1. Clone the repository.
2. Install dependencies using `npm install`.
3. Update the `.env` file with your Mapbox token.
4. Run the application using `npm run dev`.
5. Deploy the application using `npm run deploy`.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
Connect to me at <me@boyangsa.com>
