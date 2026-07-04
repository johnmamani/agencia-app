export type Profile = {
  id: string;
  displayName: string;
  age: number;
  nationality: string;
  schedule: string;
  tagline: string;
  physicalTraits: string;
  serviceDetails: string;
  treatmentStyle: string;
  costText: string;
  locationText: string;
  serviceTypeText: string;
  whatsappNumber: string;
  photos: string[];
  videos: string[];
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateProfileInput = {
  displayName: string;
  age: number;
  nationality: string;
  schedule?: string;
  tagline: string;
  physicalTraits: string;
  serviceDetails: string;
  treatmentStyle: string;
  costText: string;
  locationText: string;
  serviceTypeText: string;
  whatsappNumber: string;
  photos: string[];
  videos: string[];
  isVisible?: boolean;
};

export type UpdateProfileInput = Partial<Omit<CreateProfileInput, "isVisible">>;
