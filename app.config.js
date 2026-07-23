const baseConfig = require('./app.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    android: {
      ...baseConfig.expo.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...baseConfig.expo.android?.config,
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            },
          }
        : {}),
    },
    extra: {
      ...baseConfig.expo.extra,
      hasGoogleMapsApiKey: Boolean(googleMapsApiKey),
    },
  },
};
