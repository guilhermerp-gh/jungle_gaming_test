import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { ProviderIdentityPort } from "../../../application/ports/provider-identity.port";

@Injectable()
export class AuthGuard implements CanActivate, ProviderIdentityPort {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      provider?: { providerId: string; roles: string[] };
    }>();

    const providerId =
      (request.headers["x-provider-id"] as string | undefined) ?? "default-provider";

    request.provider = {
      providerId,
      roles: ["provider"],
    };

    return true;
  }

  async resolveProvider(req: unknown): Promise<{ providerId: string; roles: string[] } | null> {
    const r = req as { headers?: Record<string, string | undefined> };
    const providerId = r?.headers?.["x-provider-id"] ?? "default-provider";
    return { providerId, roles: ["provider"] };
  }
}
