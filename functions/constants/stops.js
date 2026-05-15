const STOPS = [
  'Yard',
  'Gate',
  'Port Loading',
  'Custom Clearence',
  'Dubai / Free Zone',
];

const STOP_ROLE_MAP = {
  Yard: 'yard',
  Gate: 'gate',
  'Port Loading': 'port',
  'Custom Clearence': 'clearence',
  'Dubai / Free Zone': 'dubai',
};

const ROUTE_MARKERS = [
  { stop: 'Yard', lat: 25.2048, lng: 55.2708, order: 1 },
  { stop: 'Gate', lat: 25.234, lng: 55.3001, order: 2 },
  { stop: 'Port Loading', lat: 25.2697, lng: 55.289, order: 3 },
  { stop: 'Custom Clearence', lat: 25.276987, lng: 55.296249, order: 4 },
  { stop: 'Dubai / Free Zone', lat: 25.0657, lng: 55.1713, order: 5 },
];

const ROUTE_LINES = STOPS.slice(0, -1).map((from, index) => ({
  from,
  to: STOPS[index + 1],
}));

module.exports = {
  STOPS,
  STOP_ROLE_MAP,
  ROUTE_MARKERS,
  ROUTE_LINES,
};
