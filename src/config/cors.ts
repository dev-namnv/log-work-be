const whitelist = [
  // Web
  'https://log-works.web.app',
];

export function getCORSWhiteList(mode: string) {
  if (mode === 'dev') {
    return [
      ...whitelist,
      ...[
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ],
    ];
  }
  return whitelist;
}
