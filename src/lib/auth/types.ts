export type UserRole = "admin" | "client";

export type AuthProfile = {
  id: string;
  role: UserRole;
  client_id: string | null;
};

export type AuthSession = {
  userId: string;
  email: string | null;
  profile: AuthProfile;
};
