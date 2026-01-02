export interface TenancyScope {
  tenant?: string;
  allowMissingTenant: boolean;
  disableTenancy: boolean;
}

export interface TenancyModuleOptions {
  headerName?: string;
  allowMissingTenant?: boolean;
  allowTenant?: (context: { req: unknown }, tenant: string) => boolean;
}
