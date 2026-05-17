const workflowBaseStops = ['yard', 'gate', 'port', 'clearence'];
const workflowTerminalStops = ['dubai', 'freezone'];
const workflowRoles = ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'];

const normalizeStop = (stop, destination = null) => {
  if (stop === undefined || stop === null) return null;

  const normalized = stop.toString().trim().toLowerCase().replace(/[\s_-]+/g, '');

  if (normalized === 'portloading') return 'port';
  if (normalized === 'customclearance' || normalized === 'customclearence') return 'clearence';
  if (normalized === 'freezone') return 'freezone';
  if (normalized === 'dubaifreezone') return destination === 'freezone' ? 'freezone' : 'dubai';
  if (normalized === 'dubai' && destination === 'freezone') return 'freezone';
  if (normalized === 'clearence' || normalized === 'clearance') return 'clearence';
  if (workflowRoles.includes(normalized)) return normalized;

  return normalized || null;
};

const getTerminalStop = (destination) => (destination === 'freezone' ? 'freezone' : 'dubai');

const getWorkflowStopsForDestination = (destination, originStop = 'yard') => {
  const terminalStop = getTerminalStop(destination);
  const stops = [...workflowBaseStops, terminalStop];
  const normalizedOrigin = normalizeStop(originStop) || 'yard';
  const originIndex = stops.indexOf(normalizedOrigin);

  return originIndex >= 0 ? stops.slice(originIndex) : stops;
};

const getNextStopForDestination = (stop, destination, originStop = 'yard') => {
  const normalizedStop = normalizeStop(stop, destination);
  const stops = getWorkflowStopsForDestination(destination, originStop);
  const index = stops.indexOf(normalizedStop);

  return index >= 0 && index < stops.length - 1 ? stops[index + 1] : null;
};

const getReturnRouteForDestination = (destination) => (destination === 'freezone' ? 'freezoneToGate' : 'dubaiToYard');

module.exports = {
  workflowRoles,
  workflowTerminalStops,
  normalizeStop,
  getTerminalStop,
  getWorkflowStopsForDestination,
  getNextStopForDestination,
  getReturnRouteForDestination,
};
