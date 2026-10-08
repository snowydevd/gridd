import type { ImageSource } from 'expo-image';

export type Category = 'JDM' | 'Clásicos' | 'Drift' | 'Tuning' | 'Euro' | 'Exposición';

export const categories: Category[] = ['JDM', 'Clásicos', 'Drift', 'Tuning', 'Euro', 'Exposición'];

export type MeetEvent = {
  id: string;
  title: string;
  /** Etiqueta de la categoría (`Category` en los datos de ejemplo, `KIND_LABELS` en los de Convex). */
  category: Category | string;
  /** Short day label shown on cards: "Hoy", "Sáb 15", "Oct 28"... */
  day: string;
  /** Long date for the detail screen. */
  date: string;
  time: string;
  endTime?: string;
  isToday?: boolean;
  place: string;
  area: string;
  /** Sin la ubicación del usuario no se puede calcular. */
  distanceKm?: number;
  going: number;
  image: ImageSource;
  description: string;
  organizer: { name: string; initials: string; verified?: boolean };
  /** Position on the stylized map, as 0–1 fractions of its width/height. */
  map: { x: number; y: number };
  /** Ubicación real, para el mapa nativo. */
  coords: { latitude: number; longitude: number };
  past?: boolean;
};

export const events: MeetEvent[] = [
  {
    id: 'midnight-meet',
    title: 'Midnight Meet MVD',
    category: 'JDM',
    day: 'Sáb 15',
    date: 'Sábado 15 de octubre',
    time: '21:00',
    endTime: '02:00',
    place: 'Explanada de Kibón',
    area: 'Pocitos',
    distanceKm: 1.4,
    going: 142,
    image: require('@/assets/images/meets/midnight-rambla.jpg'),
    description:
      'La clásica edición nocturna en la Rambla. Proyectos JDM, euro, stance y clásicos bajo las luces de Kibón. Entrada libre.',
    organizer: { name: 'Montevideo Midnight Club', initials: 'MMC', verified: true },
    map: { x: 0.56, y: 0.62 },
    coords: { latitude: -34.9126, longitude: -56.1408 },
  },
  {
    id: 'jdm-night-garage',
    title: 'JDM Night Garage',
    category: 'JDM',
    day: 'Hoy',
    date: 'Hoy, miércoles 12 de octubre',
    time: '20:30',
    isToday: true,
    place: 'Estacionamiento Carrasco',
    area: 'Carrasco Norte',
    distanceKm: 3.2,
    going: 48,
    image: require('@/assets/images/meets/jdm-garage.jpg'),
    description:
      'Juntada tranqui de proyectos japoneses en un estacionamiento techado. Traé tu auto o vení a mirar.',
    organizer: { name: 'Garage 20B', initials: '20B' },
    map: { x: 0.78, y: 0.38 },
    coords: { latitude: -34.8705, longitude: -56.0505 },
  },
  {
    id: 'clasicos-rambla',
    title: 'Clásicos en la Rambla',
    category: 'Clásicos',
    day: 'Dom 16',
    date: 'Domingo 16 de octubre',
    time: '16:00',
    place: 'Plaza Virgilio',
    area: 'Punta Gorda',
    distanceKm: 6.5,
    going: 76,
    image: require('@/assets/images/meets/clasicos-rambla.jpg'),
    description:
      'Tarde de clásicos frente al río. Muscle, vintage y nacionales restaurados. Ideal para ir en familia.',
    organizer: { name: 'Club Clásicos UY', initials: 'CCU', verified: true },
    map: { x: 0.86, y: 0.7 },
    coords: { latitude: -34.9083, longitude: -56.0846 },
  },
  {
    id: 'drift-pinar',
    title: 'Drift & Pista El Pinar',
    category: 'Drift',
    day: 'Sáb 22',
    date: 'Sábado 22 de octubre',
    time: '14:00',
    endTime: '19:00',
    place: 'Autódromo Víctor Borrat Fabini',
    area: 'El Pinar',
    distanceKm: 28,
    going: 210,
    image: require('@/assets/images/meets/drift-pinar.jpg'),
    description:
      'Tanda libre de drift en circuito cerrado. Entrada para pilotos y público general.',
    organizer: { name: 'Drift Uruguay', initials: 'DUY' },
    map: { x: 0.24, y: 0.3 },
    coords: { latitude: -34.7959, longitude: -55.9172 },
  },
  {
    id: 'expo-fierros',
    title: 'Expo Fierros del Sur',
    category: 'Exposición',
    day: 'Oct 28',
    date: 'Viernes 28 de octubre',
    time: '10:00',
    endTime: '20:00',
    place: 'Parque Roosevelt',
    area: 'Canelones',
    distanceKm: 18,
    going: 530,
    image: require('@/assets/images/meets/expo-fierros.jpg'),
    description: 'La exposición anual más grande del sur. Más de 300 autos, food trucks y música.',
    organizer: { name: 'Fierros del Sur', initials: 'FDS', verified: true },
    map: { x: 0.68, y: 0.18 },
    coords: { latitude: -34.8617, longitude: -56.0182 },
  },
  {
    id: 'euro-meet',
    title: 'Euro Meet & Dyno',
    category: 'Euro',
    day: 'Nov 04',
    date: 'Viernes 4 de noviembre',
    time: '19:00',
    place: 'Zona Franca MVD',
    area: 'Montevideo',
    distanceKm: 9,
    going: 95,
    image: require('@/assets/images/meets/euro-meet.jpg'),
    description: 'Noche europea con banco de potencia abierto. Inscripción previa para medir.',
    organizer: { name: 'Euro Club MVD', initials: 'ECM' },
    map: { x: 0.36, y: 0.5 },
    coords: { latitude: -34.8358, longitude: -56.038 },
  },
  {
    id: 'trackday-pinar',
    title: 'Trackday El Pinar',
    category: 'Drift',
    day: '08 Oct',
    date: 'Sábado 8 de octubre',
    time: '13:00',
    place: 'Autódromo de El Pinar',
    area: 'Canelones',
    distanceKm: 28,
    going: 180,
    image: require('@/assets/images/meets/gtr-neon.jpg'),
    description: 'Jornada de pista abierta.',
    organizer: { name: 'Drift Uruguay', initials: 'DUY' },
    map: { x: 0.2, y: 0.25 },
    coords: { latitude: -34.7959, longitude: -55.9172 },
    past: true,
  },
];

export const featuredEvent = events[0];
export const nearbyEvents = events.filter((e) => !e.past && (e.distanceKm ?? Infinity) < 30).slice(1, 4);
export const upcomingEvents = events.filter((e) => e.id === 'expo-fierros' || e.id === 'euro-meet');

export function getEvent(id: string) {
  return events.find((e) => e.id === id);
}
