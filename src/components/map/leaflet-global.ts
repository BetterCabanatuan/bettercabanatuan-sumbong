import L from "leaflet";

// Leaflet.markercluster is an old UMD plugin that reads the global `L`, so it must be set
// before the plugin module runs. Import this file first, then the plugin.
(globalThis as unknown as { L: typeof L }).L = L;
