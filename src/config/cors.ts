const whitelist = [
  // Web
  'https://logwork.web.app',
];

export function getCORSWhiteList(mode: string) {
  if (mode === 'dev') {
    return [
      ...whitelist,
      ...['http://localhost:5173', 'http://127.0.0.1:5173'],
    ];
  }
  return whitelist;
}
