
CREATE INDEX IF NOT EXISTS deals_org_stage_idx       ON public.deals (organization_id, stage);
CREATE INDEX IF NOT EXISTS deals_org_company_idx     ON public.deals (organization_id, company_id);
CREATE INDEX IF NOT EXISTS deals_org_close_idx       ON public.deals (organization_id, expected_close);
CREATE INDEX IF NOT EXISTS deals_org_updated_idx     ON public.deals (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS activities_org_created_idx  ON public.activities (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_org_due_idx      ON public.activities (organization_id, due_date) WHERE completed = false;
CREATE INDEX IF NOT EXISTS activities_org_deal_idx     ON public.activities (organization_id, deal_id);
CREATE INDEX IF NOT EXISTS activities_org_contact_idx  ON public.activities (organization_id, contact_id);

CREATE INDEX IF NOT EXISTS invoices_org_status_idx     ON public.invoices (organization_id, status);
CREATE INDEX IF NOT EXISTS invoices_org_due_idx        ON public.invoices (organization_id, due_date);
CREATE INDEX IF NOT EXISTS invoices_org_company_idx    ON public.invoices (organization_id, company_id);

CREATE INDEX IF NOT EXISTS tickets_org_status_idx      ON public.tickets (organization_id, status);
CREATE INDEX IF NOT EXISTS tickets_org_updated_idx     ON public.tickets (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS contacts_org_name_idx       ON public.contacts (organization_id, name);
CREATE INDEX IF NOT EXISTS companies_org_name_idx      ON public.companies (organization_id, name);
