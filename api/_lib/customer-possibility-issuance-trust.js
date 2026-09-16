const { getDatabase } = require("./database.js");

async function prepareCustomerPossibilityIssuanceTrust() {
  const database = getDatabase();
  await database.ensureSchema();
  await database.query(`ALTER TABLE demeos_customer_possibility_issuances
    ADD COLUMN IF NOT EXISTS delivery_confirmed BOOLEAN NOT NULL DEFAULT FALSE`);
  await database.query(`CREATE OR REPLACE FUNCTION demeos_fill_possibility_issuance_snapshot()
    RETURNS trigger AS $$
    DECLARE authoritative RECORD;
    BEGIN
      SELECT c.campaign, b.profile INTO authoritative
      FROM demeos_campaigns c
      JOIN demeos_businesses b ON b.business_id = c.business_id
      WHERE c.campaign_id = NEW.work_item_id;
      IF NOT FOUND THEN RETURN NULL; END IF;
      NEW.campaign_snapshot := authoritative.campaign;
      NEW.business_name_snapshot := authoritative.profile->>'name';
      NEW.location_snapshot := authoritative.profile->>'location';
      NEW.delivery_confirmed := FALSE;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`);
  await database.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'demeos_fill_possibility_issuance_snapshot_trigger') THEN
        CREATE TRIGGER demeos_fill_possibility_issuance_snapshot_trigger
        BEFORE INSERT OR UPDATE OF campaign_snapshot ON demeos_customer_possibility_issuances
        FOR EACH ROW EXECUTE FUNCTION demeos_fill_possibility_issuance_snapshot();
      END IF;
    END $$`);
  await database.query(`CREATE OR REPLACE FUNCTION demeos_guard_saved_possibility_issuance()
    RETURNS trigger AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM demeos_customer_possibility_issuances i
        JOIN demeos_campaigns c ON c.campaign_id = i.work_item_id
        JOIN demeos_businesses b ON b.business_id = c.business_id
        WHERE i.trusted_customer_identity_id = NEW.trusted_customer_identity_id
          AND i.work_item_id = NEW.work_item_id
          AND i.delivery_confirmed = TRUE
          AND i.campaign_snapshot = c.campaign
          AND i.business_name_snapshot = NEW.business_name
          AND i.business_name_snapshot = b.profile->>'name'
          AND i.location_snapshot IS NOT DISTINCT FROM NEW.location
          AND i.location_snapshot IS NOT DISTINCT FROM b.profile->>'location'
      ) THEN
        RETURN NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`);
  await database.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'demeos_guard_saved_possibility_issuance_trigger') THEN
        CREATE TRIGGER demeos_guard_saved_possibility_issuance_trigger
        BEFORE INSERT ON demeos_customer_saved_possibilities
        FOR EACH ROW EXECUTE FUNCTION demeos_guard_saved_possibility_issuance();
      END IF;
    END $$`);
}

async function confirmCustomerPossibilityIssuanceDelivery(trustedCustomerIdentityId, workItemIds) {
  if (typeof trustedCustomerIdentityId !== "string" || !trustedCustomerIdentityId.trim() ||
      !Array.isArray(workItemIds) || !workItemIds.length) return [];
  const database = getDatabase();
  const uniqueIds = [...new Set(workItemIds.filter(function (id) {
    return typeof id === "string" && id.trim();
  }))];
  if (!uniqueIds.length) return [];
  const result = await database.query(
    `UPDATE demeos_customer_possibility_issuances
     SET delivery_confirmed = TRUE, issued_at = NOW()
     WHERE trusted_customer_identity_id = $1 AND work_item_id = ANY($2::text[])
     RETURNING work_item_id`,
    [trustedCustomerIdentityId, uniqueIds]);
  return result.rows.map(function (row) { return row.work_item_id; });
}

module.exports = {
  prepareCustomerPossibilityIssuanceTrust,
  confirmCustomerPossibilityIssuanceDelivery
};
