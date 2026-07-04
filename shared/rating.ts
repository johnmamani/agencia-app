export type Rating = {
  id: string;
  profileId: string;
  clientEmail: string;
  clientName: string;
  stars: number;
  createdAt: string;
  updatedAt: string;
};

export type RatingInput = {
  profileId: string;
  clientEmail: string;
  clientName: string;
  stars: number;
};

export type RatingSummary = {
  average: number;
  total: number;
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
};
