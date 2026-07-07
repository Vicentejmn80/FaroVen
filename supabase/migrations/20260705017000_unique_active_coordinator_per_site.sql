-- FARO — High Severity Remediation A-10
-- Ensure only one active coordinator per site.

CREATE UNIQUE INDEX coordinator_profiles_site_unique
ON coordinator_profiles (site_type, site_id)
WHERE onboarding_complete = true;
