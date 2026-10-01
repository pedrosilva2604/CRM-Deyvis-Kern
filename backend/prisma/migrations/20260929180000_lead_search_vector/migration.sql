CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

ALTER TABLE "Lead" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', immutable_unaccent("name")) || to_tsvector('simple', coalesce("email", ''))
) STORED;

CREATE INDEX "Lead_searchVector_idx" ON "Lead" USING GIN ("searchVector");
