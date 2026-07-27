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
  visitLogId: string | null;
  localUri: string;
  createdAt: string;
};

export type VisitLog = {
  id: string;
  cairnId: string;
  visitDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  photos: CairnPhoto[];
};

export type Cairn = {
  id: string;
  name: string;
  story: string;
  notes: string;
  latitude: number;
  longitude: number;
  placeType: PlaceType;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastVisitedAt: string;
  primaryPhotoId: string | null;
  photos: CairnPhoto[];
  visitLogs: VisitLog[];
};

export type CairnInput = {
  name: string;
  story: string;
  notes: string;
  latitude: number;
  longitude: number;
  placeType: PlaceType;
  tags: string[];
  isFavorite: boolean;
  primaryPhotoId?: string | null;
  primaryPhotoUri?: string | null;
  photos: string[];
};

export type VisitLogInput = {
  visitDate: string;
  notes: string;
  photos: string[];
};
