import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerCustomOptions,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const swaggerServerUrl =
  process.env.SWAGGER_SERVER_URL ?? 'http://localhost:8080';

const swaggerDocumentBuilder = new DocumentBuilder()
  .setTitle('SmartRanking API')
  .setDescription(
    'Multi-tenant tennis ranking API with Better Auth, RBAC, and MongoDB.',
  )
  .setVersion('1.0.0')
  .addServer(swaggerServerUrl)
  .addCookieAuth('better-auth.session-token', {
    type: 'apiKey',
    in: 'cookie',
    description: 'Better Auth session token set via /api/auth',
  })
  .addApiKey(
    {
      type: 'apiKey',
      in: 'header',
      name: 'x-tenant-id',
      description:
        'Tenant/club identifier. Required for all protected multi-tenant endpoints.',
    },
    'Tenant',
  )
  .build();

const swaggerDocumentOptions: SwaggerDocumentOptions = {
  operationIdFactory: (controllerKey: string, methodKey: string) =>
    `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
};

const swaggerCustomOptions: SwaggerCustomOptions = {
  customSiteTitle: 'SmartRanking API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
  },
};

const OPENAPI_OUTPUT_PATH = join(
  process.cwd(),
  'docs/openapi/smartranking-openapi.json',
);

export const POSTMAN_COLLECTION_PATH = join(
  process.cwd(),
  'postman/smartranking-api.postman_collection.json',
);

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    swaggerDocumentBuilder,
    swaggerDocumentOptions,
  );
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, swaggerCustomOptions);
  return document;
}

export function persistOpenApiDocument(document: OpenAPIObject): void {
  mkdirSync(dirname(OPENAPI_OUTPUT_PATH), { recursive: true });
  writeFileSync(OPENAPI_OUTPUT_PATH, JSON.stringify(document, null, 2));
}

export function getOpenApiOutputPath(): string {
  return OPENAPI_OUTPUT_PATH;
}
