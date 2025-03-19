# Geospatial Viewer

A modern, interactive web-based geospatial data viewer built with React and deck.gl. View and analyze GeoJSON and CSV data with customizable styling options.

🌍 [Live Demo](https://bobsa514.github.io/geospatial-viewer/)

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
  - Collapsible styling controls
  - Layer reordering
- 🔍 Interactive features:
  - Hover to view feature properties
  - Pan and zoom map controls
  - Automatic viewport fitting to data

## Installation

```bash
# Clone the repository
git clone https://github.com/bobsa514/geospatial-viewer.git

# Navigate to project directory
cd geospatial-viewer

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

1. **Adding GeoJSON Data**:
   - Click the GeoJSON upload button
   - Select your GeoJSON file
   - The layer will be automatically added to the map

2. **Adding CSV Data**:
   - Click the CSV upload button
   - Select a CSV file with coordinate columns
   - Supported column names:
     - Latitude: 'lat', 'latitude', 'y'
     - Longitude: 'lng', 'long', 'longitude', 'x'

3. **Styling Layers**:
   - Click the expand button next to each layer
   - Use the color picker to change layer color
   - Adjust opacity with the slider
   - For CSV points, adjust point size with the size slider

4. **Managing Layers**:
   - Toggle layer visibility with the checkbox
   - Remove layers with the delete button
   - Collapse/expand styling options as needed

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Technologies Used

- React
- deck.gl
- MapboxGL
- TypeScript
- Vite
- TailwindCSS

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
