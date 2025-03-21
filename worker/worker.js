import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request, env, ctx) {
    try {
      return await getAssetFromKV(request, { mapRequestToAsset: req => new Request(req.url, { cf: { cacheEverything: true } }) });
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  }
};
