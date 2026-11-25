export interface Point2 {
  x: number;
  y: number;
}

export interface Footprint {
  id: number;
  name: string;
  type: string;
  polygon: Point2[];
  properties: {
    osm_id?: string;
    kind?: string;
    levels?: number;
  };
}

export interface Lane {
  id: string;
  osm_id: string;
  name: string;
  from: string;
  to: string;
  kind: string;
  width_m: number;
  oneway: boolean;
  drivable: boolean;
  bus_compatible: boolean;
  length_px: number;
  points: Point2[];
}

export interface LaneData {
  crs: string;
  px_per_m: number;
  origin_x: number;
  origin_y: number;
  bus_min_width_m: number;
  lanes: Lane[];
  nodes: Record<string, Point2>;
}

export interface RolePlace {
  osm_id: string;
  name: string;
  source_poi: string | null;
  distance_m: number;
  door_px: [number, number];
  center_px: [number, number];
}

export interface FocusData {
  crs: string;
  origin_x: number;
  origin_y: number;
  px_per_m: number;
  spawn_px: [number, number];
  spawn_source: { road: string; osm_id: string };
  landmarks: Record<string, [number, number] | Point2[]>;
  roles: Record<string, RolePlace>;
  approximations: string[];
}

export interface MapMeta {
  width: number;
  height: number;
  tile_px: number;
  px_per_m: number;
  origin_x: number;
  origin_y: number;
  buildings: number;
  roads: number;
  pois: number;
}

export interface TiledLayer {
  name: string;
  width?: number;
  height?: number;
  data?: number[];
  objects?: Footprint[];
}

export interface TiledMap {
  width: number;
  height: number;
  layers: TiledLayer[];
}

export interface TileLayerData {
  name: string;
  data: number[];
}
