# MapViewerGL

A modern web-based map viewer that supports multiple data formats and interactive visualization.

🌍 [Live Demo](https://bobsa514.github.io/mapviewer-gl/)

## Important Notes

### Data Storage
- **No Data Storage**: Please note that this tool does not store any data on the server. All data processing occurs locally on the user's machine. Once the session is closed, any uploaded data will be lost. This design ensures user privacy and data security.

### Mapbox Token
- **Environment Configuration**: It is REQUIRED to change the `.env` file in your project directory to include your own Mapbox token. The demo token included has strict usage limits and may stop working if exceeded.
- **Token Requirements**: 
  - Sign up for a free account at [Mapbox](https://www.mapbox.com/signup/)
  - Create a new public token in your account
  - The free tier includes 50,000 map loads per month
  - The map will stop working if this limit is exceeded
- **Usage Limits**:
  - The free Mapbox tier has a limit of 50,000 map loads per month
  - Once this limit is reached, the map will stop loading for new users
  - The limit resets at the start of each billing cycle
  - Consider using the free CartoDB basemaps ("Light", "Dark", "City") which don't have these restrictions
- To set your token, open the `.env` file and replace the placeholder with your own Mapbox access token:
  ```plaintext
  VITE_MAPBOX_TOKEN=your_mapbox_token_here
  ```
- **⚠️ Warning**: Never commit your `.env` file to version control. Add it to your `.gitignore` file.

## Features

- 📍 Support for multiple data formats:
  - GeoJSON files for polygon/line/point data
  - CSV files with coordinate data (auto-detects lat/long columns)
  - CSV files with H3 hexagon indices
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

## Data Format Requirements

### GeoJSON
- Standard GeoJSON format with Feature Collection
- Properties will be available for filtering and display

### CSV (Points)
- Must include coordinate columns with one of these naming patterns:
  - Latitude: `lat`, `latitude`, or `y`
  - Longitude: `lng`, `long`, `longitude`, or `x`
- Additional columns will be available as properties

### CSV (H3 Hexagons)
- Must include an H3 index column with one of these names:
  - `hex_id`, `h3_index`, `h3`, or `hexagon`
- H3 indices must be valid H3 cell addresses
- Additional columns will be available as properties

## Usage
1. Clone the repository.
2. Install dependencies using `npm install`.
3. Update the `.env` file with your Mapbox token.
4. Run the application using `npm run dev`.
5. Deploy the application using `npm run deploy`.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
Connect to me at <me@boyangsa.com>
