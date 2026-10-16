// Sample neighborhoods, carried over from the earlier static demo.
// Coordinates are simple demo map units, not real GPS coordinates —
// a real version would use latitude/longitude with PostGIS instead.

export type Neighborhood = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export const NEIGHBORHOODS: Neighborhood[] = [
  { id: "downtown", name: "Downtown", x: 0, y: 0 },
  { id: "riverside", name: "Riverside", x: 3, y: 1 },
  { id: "hillcrest", name: "Hillcrest", x: -2, y: 4 },
  { id: "old-town", name: "Old Town", x: 1, y: -3 },
];

export function findNeighborhood(id: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.id === id);
}
