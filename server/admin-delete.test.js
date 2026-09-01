import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteBooking, deletePackage } from './admin-delete.js';

function fakeClient(rowsByCall) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      calls.push({ text, params });
      return { rows: rowsByCall[calls.length - 1] || [] };
    },
  };
}

test('deleting a booking releases its seats and writes an audit event', async () => {
  const client = fakeClient([[{ id: 'booking-1', reference: 'GA-100', departureId: 'departure-1', travellerCount: 3 }]]);

  await deleteBooking(client, 'booking-1', 'admin-1');

  assert.equal(client.calls.length, 4);
  assert.match(client.calls[1].text, /DELETE FROM bookings/);
  assert.deepEqual(client.calls[2].params, [3, 'departure-1']);
  assert.match(client.calls[3].text, /DELETE_BOOKING/);
});

test('deleting a package is blocked while customer bookings exist', async () => {
  const client = fakeClient([[{ id: 'package-1', name: 'Kashmir', bookingCount: 2 }]]);

  await assert.rejects(
    deletePackage(client, 'package-1', 'admin-1'),
    error => error.status === 409 && error.code === 'PACKAGE_HAS_BOOKINGS',
  );
  assert.equal(client.calls.length, 1);
});

test('deleting an unused package removes it and writes an audit event', async () => {
  const client = fakeClient([[{ id: 'package-1', name: 'Kashmir', bookingCount: 0 }]]);

  await deletePackage(client, 'package-1', 'admin-1');

  assert.equal(client.calls.length, 3);
  assert.match(client.calls[1].text, /DELETE FROM packages/);
  assert.match(client.calls[2].text, /DELETE_PACKAGE/);
});
