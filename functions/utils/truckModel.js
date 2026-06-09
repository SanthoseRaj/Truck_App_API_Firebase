const TRUCK_MODEL_DISPLAY_VALUES = ['2 Axle', '3 Axle', '6 Wheel', 'Flat Trailer'];

const legacyTruckModelMap = {
  threeAxis: '2 Axle',
  fourAxis: '3 Axle',
  sixAxis: '6 Wheel',
};

const normalizeTruckModel = (value) => {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();

  if (TRUCK_MODEL_DISPLAY_VALUES.includes(trimmedValue)) {
    return trimmedValue;
  }

  return legacyTruckModelMap[trimmedValue] || null;
};

module.exports = {
  TRUCK_MODEL_DISPLAY_VALUES,
  normalizeTruckModel,
};
