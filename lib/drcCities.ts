export type DrcCity = {
  name: string;
  lat: number;
  lng: number;
};

// Coordonnées approximatives des centres-villes (usage indicatif uniquement).
export const DRC_CITIES: DrcCity[] = [
  { name: "Kolwezi", lat: -10.7167, lng: 25.4667 },
  { name: "Kinshasa", lat: -4.4419, lng: 15.2663 },
  { name: "Lubumbashi", lat: -11.6876, lng: 27.5026 },
  { name: "Goma", lat: -1.6792, lng: 29.2228 },
  { name: "Bukavu", lat: -2.5083, lng: 28.8608 },
  { name: "Kisangani", lat: 0.5167, lng: 25.2 },
  { name: "Kananga", lat: -5.896, lng: 22.4176 },
  { name: "Mbuji-Mayi", lat: -6.1358, lng: 23.5892 },
];

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getCity(name: string): DrcCity {
  const city = DRC_CITIES.find((c) => c.name === name);
  if (!city) throw new Error(`Ville inconnue: ${name}`);
  return city;
}

export function findNearestCity(lat: number, lng: number): { city: DrcCity; distanceKm: number } {
  let nearest = DRC_CITIES[0];
  let minDist = haversineDistanceKm(lat, lng, nearest.lat, nearest.lng);

  for (const city of DRC_CITIES.slice(1)) {
    const dist = haversineDistanceKm(lat, lng, city.lat, city.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = city;
    }
  }

  return { city: nearest, distanceKm: Math.round(minDist) };
}
