export interface ProviderIdentity {
  providerId: string;
  roles: string[];
}

export interface ProviderIdentityPort {
  resolveProvider(req: unknown): Promise<ProviderIdentity | null>;
}
