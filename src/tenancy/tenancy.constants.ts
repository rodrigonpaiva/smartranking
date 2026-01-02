export const TENANCY_HEADER_NAME = 'x-tenant-id';
// Allow simple slugs/ObjectIds and guard against header smuggling
export const TENANCY_HEADER_PATTERN = /^[a-zA-Z0-9-]{3,64}$/;
