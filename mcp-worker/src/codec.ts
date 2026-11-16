export type FirestorePrimitive =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { bytesValue: string }
  | { referenceValue: string }
  | { geoPointValue: { latitude: number; longitude: number } }
  | { arrayValue: { values?: FirestorePrimitive[] } }
  | { mapValue: { fields?: Record<string, FirestorePrimitive> } }

export function encodeValue(value: unknown): FirestorePrimitive {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } }
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } }
  }
  return { stringValue: String(value) }
}

export function decodeValue(value: FirestorePrimitive | undefined): unknown {
  if (!value) return null
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('stringValue' in value) return value.stringValue
  if ('bytesValue' in value) return value.bytesValue
  if ('referenceValue' in value) return value.referenceValue
  if ('geoPointValue' in value) return value.geoPointValue
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(decodeValue)
  }
  if ('mapValue' in value) return decodeFields(value.mapValue.fields)
  return null
}

export function encodeFields(input: Record<string, unknown>): Record<string, FirestorePrimitive> {
  const fields: Record<string, FirestorePrimitive> = {}
  for (const [key, value] of Object.entries(input)) {
    fields[key] = encodeValue(value)
  }
  return fields
}

export function decodeFields(
  fields: Record<string, FirestorePrimitive> | undefined,
): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields ?? {})) {
    output[key] = decodeValue(value)
  }
  return output
}
