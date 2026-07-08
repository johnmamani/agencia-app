export type Profile = {
  id: string;
  displayName: string;
  age: number;
  nationality: string;
  schedule: string;
  serviceDetails: string;
  treatmentStyle: string;
  costText: string;
  locationText: string;
  serviceTypeText: string;
  whatsappNumber: string;
  photos: string[];
  videos: string[];
  isVisible: boolean;
  isLanding: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateProfileInput = {
  displayName: string;
  age: number;
  nationality: string;
  schedule?: string;
  serviceDetails: string;
  treatmentStyle: string;
  costText: string;
  locationText: string;
  serviceTypeText: string;
  whatsappNumber: string;
  photos: string[];
  videos: string[];
  isVisible?: boolean;
  isLanding?: boolean;
};

export type UpdateProfileInput = Partial<Omit<CreateProfileInput, "isVisible">>;
