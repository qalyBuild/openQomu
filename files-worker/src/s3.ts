import { AwsClient } from 'aws4fetch'
import type { Env } from './env'

let cached:
  | { keyId: string; secret: string; region: string; client: AwsClient }
  | null = null

function client(env: Env): AwsClient {
  if (
    cached &&
    cached.keyId === env.S3_ACCESS_KEY_ID &&
    cached.secret === env.S3_SECRET_ACCESS_KEY &&
    cached.region === env.S3_REGION
  ) {
    return cached.client
  }
  const client = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: 's3',
    region: env.S3_REGION,
  })
  cached = {
    keyId: env.S3_ACCESS_KEY_ID,
    secret: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
    client,
  }
  return client
}

/** Clave estable del objeto: renombrar el archivo no lo mueve en el almacenamiento. */
export function objectKey(workspaceId: string, fileId: string): string {
  return `workspaces/${workspaceId}/${fileId}`
}

function objectUrl(env: Env, key: string): string {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '')
  return env.S3_BUCKET
    ? `${endpoint}/${encodeURIComponent(env.S3_BUCKET)}/${encodedKey}`
    : `${endpoint}/${encodedKey}`
}

export function putObject(
  env: Env,
  key: string,
  body: ArrayBuffer,
  contentType: string,
  fileName: string,
): Promise<Response> {
  return client(env).fetch(objectUrl(env, key), {
    method: 'PUT',
    body,
    headers: {
      'content-type': contentType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

export function getObject(
  env: Env,
  key: string,
  method: 'GET' | 'HEAD' = 'GET',
  headers: Record<string, string> = {},
): Promise<Response> {
  return client(env).fetch(objectUrl(env, key), { method, headers })
}

export function deleteObject(env: Env, key: string): Promise<Response> {
  return client(env).fetch(objectUrl(env, key), { method: 'DELETE' })
}
