export type Tone = "professional" | "casual" | "random";
export type PlanId = "plus" | "premium" | "ultra";
export type Dietary = "veg" | "non-veg" | "vegan" | "eggetarian" | "halal" | "jain";
export type GroupSize = "one-on-one" | "small-group";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface UserLocation {
  city: string;
  area?: string;
  /** Rounded to ~1 km (2 decimals) before it is ever stored. */
  point?: GeoPoint;
}

export interface Preferences {
  foodInterests: string[];
  tone: Tone;
  location: UserLocation;
  dietary: Dietary;
  budget: [number, number];
  groupSize: GroupSize;
  timeSlots: string[];
  languages: string[];
  topics: string[];
  goals: string[];
  dateOfBirth: string;
}

export interface Consent {
  adult: boolean;
  respectful: boolean;
  termsVersion: string;
  acceptedAt: string;
}

export interface AvatarConfig {
  skin: string;
  hair: string;
  hairColor: string;
  outfit: string;
  accessory: string;
  background: string;
}

export interface MockUser {
  id: string;
  name: string;
  handle: string;
  bio: string;
  city: string;
  area: string;
  point: GeoPoint;
  foodInterests: string[];
  tone: Tone;
  dietary: Dietary;
  budget: [number, number];
  languages: string[];
  trustScore: number;
  /** Whole years. Absent when the profile has no date of birth. The raw date is never sent. */
  age?: number;
  streak: number;
  plan: PlanId;
  avatar: AvatarConfig;
  followers: number;
  following: number;
  connections: number;
}

export interface Story {
  id: string;
  userId: string;
  kind: "image" | "video";
  src: string;
  caption?: string;
  createdAt: string;
  views: number;
}
