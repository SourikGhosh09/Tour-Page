export async function createGuestReview(client, data, mediaRows) {
  const settings = await client.query("SELECT value FROM site_settings WHERE key='reviewModeration'");
  const published = settings.rows[0]?.value?.autoApprove === true;
  const result = await client.query(
    `INSERT INTO reviews(traveller_name,guest_email,destination,travelled_on,rating,quote,verified,published)
     VALUES($1,$2,$3,$4,$5,$6,false,$7) RETURNING id,published`,
    [data.travellerName,data.guestEmail,data.destination,data.travelledOn,data.rating,data.quote,published]
  );
  const review = result.rows[0];
  for (const [index, media] of mediaRows.entries()) {
    await client.query(
      `INSERT INTO review_media(review_id,media_type,media_url,mime_type,original_name,display_order)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [review.id,media.mimeType.startsWith('video/')?'video':'image',media.url,media.mimeType,media.originalName,index]
    );
  }
  return review;
}
