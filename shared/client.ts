export type ClientStatus = "pending" | "approved" | "rejected";

export type Client = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type UpdateClientInput = Partial<CreateClientInput> & {
  status?: ClientStatus;
};
