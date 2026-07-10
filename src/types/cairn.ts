export const PLACE_TYPES = [
  'Campsite',
  'Fishing Spot',
  'Trailhead',
  'Viewpoint',
  'Waterfall',
  'Boat Launch',
  'Foraging Area',
  'Wildflower Meadow',
  'Other',
] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_TYPE_ICONS: Record<PlaceType, string> = {
  Campsite: '🏕',
  'Fishing Spot': '🎣',
  Trailhead: '🥾',
  Viewpoint: '🌅',
  Waterfall: '💧',
  'Boat Launch': '🛶',
  'Foraging Area': '🍄',
  'Wildflower Meadow': '🌸',
  Other: '📍',
};

export type CairnPhoto = {
  id: string;
  cairnId: string;
  localUri: string;
  createdAt: string;
};

export type Cairn = {
  id: string;
  name: string;
  story: string;
  notes: string;
  latitude: number;
  longitude: number;
  placeType: PlaceType;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastVisitedAt: string;
  primaryPhotoId: string | null;
  photos: CairnPhoto[];
};

export type CairnInput = {
  name: string;
  story: string;
  notes: string;
  latitude: number;
  longitude: number;
  placeType: PlaceType;
  isFavorite: boolean;
  lastVisitedAt?: string;
  primaryPhotoId?: string | null;
  primaryPhotoUri?: string | null;
  photos: string[];
};
