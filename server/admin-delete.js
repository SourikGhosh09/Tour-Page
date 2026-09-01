export class AdminDeleteError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function deleteBooking(client, bookingId, actorId) {
  const bookingResult = await client.query(
    `SELECT id, reference, departure_id AS "departureId", traveller_count AS "travellerCount"
     FROM bookings
     WHERE id=$1
     FOR UPDATE`,
    [bookingId],
  );
  const booking = bookingResult.rows[0];
  if (!booking) {
    throw new AdminDeleteError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  await client.query('DELETE FROM bookings WHERE id=$1', [bookingId]);
  await client.query(
    `UPDATE departures
     SET seats_reserved=GREATEST(0,seats_reserved-$1)
     WHERE id=$2`,
    [Number(booking.travellerCount), booking.departureId],
  );
  await client.query(
    `INSERT INTO admin_audit_log(actor_id,action,target_type,target_id,metadata)
     VALUES($1,'DELETE_BOOKING','booking',$2,$3)`,
    [actorId, bookingId, JSON.stringify({ reference: booking.reference })],
  );
}

export async function deletePackage(client, packageId, actorId) {
  const packageResult = await client.query(
    `SELECT p.id,p.name,
       (SELECT COUNT(*)::int
        FROM departures d
        JOIN bookings b ON b.departure_id=d.id
        WHERE d.package_id=p.id) AS "bookingCount"
     FROM packages p
     WHERE p.id=$1
     FOR UPDATE OF p`,
    [packageId],
  );
  const packageRecord = packageResult.rows[0];
  if (!packageRecord) {
    throw new AdminDeleteError(404, 'PACKAGE_NOT_FOUND', 'Package not found.');
  }
  if (Number(packageRecord.bookingCount) > 0) {
    throw new AdminDeleteError(
      409,
      'PACKAGE_HAS_BOOKINGS',
      'Delete this package’s bookings first. Existing customer records are protected.',
    );
  }

  await client.query('DELETE FROM packages WHERE id=$1', [packageId]);
  await client.query(
    `INSERT INTO admin_audit_log(actor_id,action,target_type,target_id,metadata)
     VALUES($1,'DELETE_PACKAGE','package',$2,$3)`,
    [actorId, packageId, JSON.stringify({ name: packageRecord.name })],
  );
}
