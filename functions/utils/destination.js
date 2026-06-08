const normalizeDestination = (destination) => {
  if (destination === undefined || destination === null) return null;

  const normalized = destination.toString().trim().toLowerCase().replace(/[\s_-]+/g, '');

  if (normalized === 'dubai') return 'dubai';
  if (normalized === 'freezone') return 'freezone';
  if (normalized === 'freezonedubai' || normalized === 'freezoneanddubai') return 'freezoneDubai';

  return null;
};

module.exports = {
  normalizeDestination,
};
