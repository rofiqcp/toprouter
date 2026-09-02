-- Insert provider connections for kie & deapi (API key from env)
INSERT INTO providerconnections (id, provider, authtype, name, email, priority, isactive, data, createdat, updatedat)
VALUES (
  'kie-001', 'kie', 'apikey', 'KIE AI', NULL, 65, 1,
  jsonb_build_object(
    'apiKey', '${KIE_API_KEY}',
    'testStatus', 'untested',
    'providerSpecificData', jsonb_build_object(
      'prefix', 'kie', 'apiType', 'image', 'nodeName', 'KIE AI',
      'connectionProxyEnabled', false, 'connectionProxyUrl', '', 'connectionNoProxy', ''
    ),
    'consecutiveUseCount', 0
  ),
  NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  authtype = EXCLUDED.authtype,
  name = EXCLUDED.name,
  isactive = EXCLUDED.isactive,
  data = EXCLUDED.data,
  updatedat = NOW();

INSERT INTO providerconnections (id, provider, authtype, name, email, priority, isactive, data, createdat, updatedat)
VALUES (
  'deapi-001', 'deapi', 'apikey', 'deAPI', NULL, 66, 1,
  jsonb_build_object(
    'apiKey', '${DEAPI_KEY}',
    'testStatus', 'untested',
    'providerSpecificData', jsonb_build_object(
      'prefix', 'deapi', 'apiType', 'image', 'nodeName', 'deAPI',
      'connectionProxyEnabled', false, 'connectionProxyUrl', '', 'connectionNoProxy', ''
    ),
    'consecutiveUseCount', 0
  ),
  NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  authtype = EXCLUDED.authtype,
  name = EXCLUDED.name,
  isactive = EXCLUDED.isactive,
  data = EXCLUDED.data,
  updatedat = NOW();

-- Insert customModels (DB-driven, deletable) — kie
INSERT INTO kv (scope, key, value) VALUES
  ('customModels', 'kie|nano-banana-2|image', '{"providerAlias":"kie","id":"nano-banana-2","type":"image","name":"Nano Banana 2"}'),
  ('customModels', 'kie|seedream/5-pro-image-to-image|image', '{"providerAlias":"kie","id":"seedream/5-pro-image-to-image","type":"image","name":"Seedream 5 Pro (Image-to-Image)"}')
ON CONFLICT (scope, key) DO NOTHING;

-- Insert customModels — deapi
INSERT INTO kv (scope, key, value) VALUES
  ('customModels', 'deapi|Flux1schnell|image', '{"providerAlias":"deapi","id":"Flux1schnell","type":"image","name":"Flux 1 Schnell"}'),
  ('customModels', 'deapi|ZImageTurbo_INT8|image', '{"providerAlias":"deapi","id":"ZImageTurbo_INT8","type":"image","name":"Z Image Turbo INT8"}'),
  ('customModels', 'deapi|Flux_2_Klein_4B_BF16|image', '{"providerAlias":"deapi","id":"Flux_2_Klein_4B_BF16","type":"image","name":"Flux 2 Klein 4B BF16"}'),
  ('customModels', 'deapi|ZAnimeDistill_8Step_INT8|image', '{"providerAlias":"deapi","id":"ZAnimeDistill_8Step_INT8","type":"image","name":"Z Anime Distill 8Step INT8"}')
ON CONFLICT (scope, key) DO NOTHING;
