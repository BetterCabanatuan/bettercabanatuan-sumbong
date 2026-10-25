"use client";

import { createElementObject, createPathComponent, extendContext } from "@react-leaflet/core";
import L from "leaflet";
import "./leaflet-global";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { ReactNode } from "react";
import { clusterSize } from "@/lib/map-marker";

interface Props extends L.MarkerClusterGroupOptions {
  children?: ReactNode;
}

const CLUSTER_PX = { sm: 38, md: 44, lg: 52 } as const;

/** A navy bubble with a white count; the size steps up with the number of Reports inside. */
function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const px = CLUSTER_PX[clusterSize(count)];
  return L.divIcon({
    className: "cbn-cluster",
    iconSize: [px, px],
    html: `<span class="grid size-full place-items-center rounded-full bg-navy text-sm font-bold text-navy-foreground shadow-md ring-2 ring-white">${count}</span>`,
  });
}

/**
 * Wraps `L.markerClusterGroup` as a react-leaflet container: plain `<Marker>` children register
 * with the group instead of the map. Cleanup removes the group, so React strict mode's
 * double-mount leaves one layer.
 */
export const MarkerClusterGroup = createPathComponent<L.MarkerClusterGroup, Props>(
  function createCluster(props, context) {
    const options: L.MarkerClusterGroupOptions & { children?: ReactNode } = { ...props };
    delete options.children; // React children are not Leaflet options
    const instance = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      iconCreateFunction: clusterIcon,
      ...options,
    });
    return createElementObject(instance, extendContext(context, { layerContainer: instance, overlayContainer: instance }));
  },
);
