-- Must commit before indexes/policies that reference these labels.
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'converted';
