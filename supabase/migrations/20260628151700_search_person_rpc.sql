-- RPC used by frontend/src/hooks/useSearch.ts
-- Idempotent replacement.

CREATE OR REPLACE FUNCTION search_person(
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  first_name VARCHAR,
  last_name VARCHAR,
  status person_status,
  hospital_name VARCHAR,
  shelter_name VARCHAR,
  confidence confidence_level,
  source_name VARCHAR,
  updated_at TIMESTAMPTZ,
  notes TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.status,
    h.name::VARCHAR AS hospital_name,
    s.name::VARCHAR AS shelter_name,
    p.confidence,
    src.name::VARCHAR AS source_name,
    p.updated_at,
    p.notes,
    CASE
      WHEN COALESCE(p_first_name, '') = '' AND COALESCE(p_last_name, '') = '' THEN 0::REAL
      ELSE ts_rank(
        p.full_name_ts,
        to_tsquery(
          'spanish',
          trim(
            BOTH ' &'
            FROM
            (CASE WHEN COALESCE(p_first_name, '') <> '' THEN p_first_name || ':*' ELSE '' END) ||
            (CASE WHEN COALESCE(p_first_name, '') <> '' AND COALESCE(p_last_name, '') <> '' THEN ' & ' ELSE '' END) ||
            (CASE WHEN COALESCE(p_last_name, '') <> '' THEN p_last_name || ':*' ELSE '' END)
          )
        )
      )
    END AS rank
  FROM persons p
  LEFT JOIN hospitals h ON p.hospital_id = h.id
  LEFT JOIN shelters s ON p.shelter_id = s.id
  LEFT JOIN sources src ON p.source_id = src.id
  WHERE p.deleted_at IS NULL
    AND (
      (COALESCE(p_first_name, '') = '' AND COALESCE(p_last_name, '') = '')
      OR (COALESCE(p_first_name, '') <> '' AND p.first_name % p_first_name)
      OR (COALESCE(p_last_name, '') <> '' AND p.last_name % p_last_name)
      OR (
        COALESCE(p_first_name, '') <> '' OR COALESCE(p_last_name, '') <> ''
      ) AND p.full_name_ts @@ to_tsquery(
        'spanish',
        trim(
          BOTH ' &'
          FROM
          (CASE WHEN COALESCE(p_first_name, '') <> '' THEN p_first_name || ':*' ELSE '' END) ||
          (CASE WHEN COALESCE(p_first_name, '') <> '' AND COALESCE(p_last_name, '') <> '' THEN ' & ' ELSE '' END) ||
          (CASE WHEN COALESCE(p_last_name, '') <> '' THEN p_last_name || ':*' ELSE '' END)
        )
      )
    )
  ORDER BY rank DESC, p.updated_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_person(TEXT, TEXT, INTEGER) TO anon, authenticated;
