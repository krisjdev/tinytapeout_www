// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout LTD

import { renderToString } from 'react-dom/server';
import { isSkipCache } from '../../utils/cache.js';
import { ShuttlePage } from '../../components/ShuttlePage.js';
import { notFound } from '../../utils/notFound.js';
import { loadShuttleIndex, loadShuttleMapSvg } from '../../model/shuttle.js';

const cache = caches.default;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cached = await cache.match(context.request);
  if (cached && !isSkipCache(context)) {
    return cached;
  }

  const { shuttle } = context.params as { shuttle: string };

  const basePage = await context.env.ASSETS.fetch(context.request);
  if (!basePage) {
    return notFound(context);
  }

  const baseContent = await basePage.text();
  // NOTE: should i return a cached version here if baseContent == null?
  const isTemplatePage = baseContent.includes('{{CONTENT}}');

  var response: Response | null = null;
  const responseHeaders = {
    'Content-Type': 'text/html',
    'Cache-Control': 'public, max-age=600',
  };

  // early exit on non-template shuttle pages
  // return the existing content
  if (!isTemplatePage) {
    response = new Response(baseContent, { headers: responseHeaders });
    context.waitUntil(cache.put(context.request, response.clone()));
    return response;
  }

  // anything after this point is for a blank shuttle page
  const shuttleInfo = await loadShuttleIndex(shuttle);
  if (!shuttleInfo) {
    return notFound(context);
  }

  const shuttleSVG = await loadShuttleMapSvg(context, shuttle);
  if (!shuttleSVG) {
    return notFound(context);
  }

  response = new Response(
    baseContent.replaceAll(
      '{{CONTENT}}',
      renderToString(ShuttlePage({ shuttle, shuttleInfo, shuttleSVG })),
    ),
    { headers: responseHeaders },
  );

  context.waitUntil(cache.put(context.request, response.clone()));
  return response;
};
