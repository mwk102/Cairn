export type CoordinatePair = {
  latitude: number;
  longitude: number;
};

export type CoordinateParseResult =
  | { status: 'valid'; coordinate: CoordinatePair; normalized: string }
  | { status: 'potentially-reversed'; coordinate: CoordinatePair; swapped: CoordinatePair; normalized: string; message: string }
  | { status: 'incomplete'; message: string }
  | { status: 'invalid'; message: string };

type ParsedNumber = {
  value: number;
  direction?: 'N' | 'S' | 'E' | 'W';
};

const NUMBER_WITH_DIRECTION = /([+-]?\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*([NSEW])?/gi;

export function formatCoordinates(coordinate: CoordinatePair) {
  return `${formatCoordinateValue(coordinate.latitude)}, ${formatCoordinateValue(coordinate.longitude)}`;
}

export function formatCoordinateValue(value: number) {
  return value.toFixed(5);
}

export function validateCoordinates(latitude: number, longitude: number): CoordinateParseResult {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { status: 'incomplete', message: 'Enter both latitude and longitude.' };
  }

  const coordinate = { latitude, longitude };
  const swapped = { latitude: longitude, longitude: latitude };

  if (!isValidLatitude(latitude)) {
    if (isValidCoordinate(swapped)) {
      return reversedResult(coordinate, swapped);
    }
    return { status: 'invalid', message: 'Latitude must be between -90 and 90.' };
  }

  if (!isValidLongitude(longitude)) {
    return { status: 'invalid', message: 'Longitude must be between -180 and 180.' };
  }

  if (detectPotentiallyReversedCoordinates(coordinate)) {
    return reversedResult(coordinate, swapped);
  }

  return {
    status: 'valid',
    coordinate,
    normalized: formatCoordinates(coordinate),
  };
}

export function parseCoordinateInput(input: string): CoordinateParseResult {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    return { status: 'incomplete', message: 'Enter both latitude and longitude.' };
  }

  const numbers = extractNumbers(normalizedInput);

  if (numbers.length === 1) {
    return { status: 'incomplete', message: 'Enter both latitude and longitude.' };
  }

  if (numbers.length !== 2) {
    return { status: 'invalid', message: 'We couldn\'t recognize those coordinates.' };
  }

  const [first, second] = numbers;
  const latitude = valueWithDirection(first);
  const longitude = valueWithDirection(second);

  return validateCoordinates(latitude, longitude);
}

export function detectPotentiallyReversedCoordinates(coordinate: CoordinatePair) {
  const swapped = { latitude: coordinate.longitude, longitude: coordinate.latitude };

  return !isValidCoordinate(coordinate) && isValidCoordinate(swapped);
}

function extractNumbers(input: string): ParsedNumber[] {
  const values: ParsedNumber[] = [];

  for (const match of input.matchAll(NUMBER_WITH_DIRECTION)) {
    values.push({
      value: Number(match[1]),
      direction: match[2]?.toUpperCase() as ParsedNumber['direction'],
    });
  }

  return values;
}

function valueWithDirection(parsed: ParsedNumber) {
  if (parsed.direction === 'S' || parsed.direction === 'W') {
    return -Math.abs(parsed.value);
  }

  if (parsed.direction === 'N' || parsed.direction === 'E') {
    return Math.abs(parsed.value);
  }

  return parsed.value;
}

function isValidCoordinate(coordinate: CoordinatePair) {
  return isValidLatitude(coordinate.latitude) && isValidLongitude(coordinate.longitude);
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function reversedResult(coordinate: CoordinatePair, swapped: CoordinatePair): CoordinateParseResult {
  return {
    status: 'potentially-reversed',
    coordinate,
    swapped,
    normalized: formatCoordinates(coordinate),
    message: 'These coordinates may be reversed. Swap them?',
  };
}
