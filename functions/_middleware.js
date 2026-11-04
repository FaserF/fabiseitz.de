// Cloudflare Pages Functions - URL Shortener Middleware
// Handles high-speed edge redirects for both go.fabiseitz.de/* and fabiseitz.de/go/*

const SHORTLINKS = {
  'tr': 'https://refnocode.trade.re/bcnklq6w',
  'traderepublic': 'https://refnocode.trade.re/bcnklq6w',
  'finanzfluss': 'https://www.finanzfluss.de/copilot/',
  'ledger': 'https://shop.ledger.com',
  'audible': 'https://www.amazon.de/hz/audible/mlp',
  'sponsor': 'https://github.com/sponsors/FaserF',
  'ha-hardware': 'https://www.home-assistant.io/green/',
  'ha-router': 'https://www.home-assistant.io/integrations/openwrt/',
  'ha-shelly': 'https://www.home-assistant.io/integrations/shelly/',
  'ha-tasmota': 'https://www.home-assistant.io/integrations/tasmota/',
  'ha-zigbee': 'https://www.home-assistant.io/connectzbt1/',
  'ha-plugs': 'https://www.home-assistant.io/integrations/#energy',
  'ha-vacuum': 'https://www.home-assistant.io/integrations/#vacuum',
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  // 1. Domain: go.fabiseitz.de/*
  if (hostname === 'go.fabiseitz.de') {
    const rawSlug = url.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase().trim();

    // Root of go.fabiseitz.de -> serve the /go/ overview hub
    if (!rawSlug) {
      url.pathname = '/go/';
      return context.env.ASSETS ? context.env.ASSETS.fetch(new Request(url.toString(), request)) : context.next();
    }

    // Direct redirect if slug matches
    if (SHORTLINKS[rawSlug]) {
      return Response.redirect(SHORTLINKS[rawSlug], 302);
    }

    // Unknown slug on go.fabiseitz.de -> redirect to /go/ hub
    url.pathname = '/go/';
    return Response.redirect(url.toString(), 302);
  }

  // 2. Domain: fabiseitz.de/go/*
  if (url.pathname.startsWith('/go/')) {
    const rawSlug = url.pathname.replace(/^\/go\/?/, '').split('/')[0].toLowerCase().trim();
    if (rawSlug && SHORTLINKS[rawSlug]) {
      return Response.redirect(SHORTLINKS[rawSlug], 302);
    }
  }

  return context.next();
}
