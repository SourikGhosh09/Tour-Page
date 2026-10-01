import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestReview } from './review-submission.js';
import { reviewModerationSchema } from './validation.js';

const data={travellerName:'Guest',guestEmail:'guest@example.com',destination:'Darjeeling',travelledOn:null,rating:5,quote:'A wonderful journey'};
for(const [label,value,expected] of [['missing',undefined,false],['manual',{autoApprove:false},false],['automatic',{autoApprove:true},true],['malformed',{autoApprove:'true'},false]]){
  test(`${label} moderation saves the correct publication state and all media`,async()=>{
    const calls=[];
    const client={query:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT'))return {rows:value?[{value}]:[]};if(sql.includes('INSERT INTO reviews('))return {rows:[{id:'review-1',published:params[6]}]};return {rows:[]};}};
    const media=[{url:'/uploads/photo.jpg',mimeType:'image/jpeg',originalName:'photo.jpg'},{url:'/uploads/clip.mp4',mimeType:'video/mp4',originalName:'clip.mp4'}];
    const review=await createGuestReview(client,data,media);
    assert.equal(review.published,expected);
    assert.deepEqual(calls.slice(2).map(call=>call.params),[['review-1','image','/uploads/photo.jpg','image/jpeg','photo.jpg',0],['review-1','video','/uploads/clip.mp4','video/mp4','clip.mp4',1]]);
  });
}
test('moderation toggle requires a boolean and rejects extra client fields',()=>{
  assert.equal(reviewModerationSchema.safeParse({autoApprove:true}).success,true);
  assert.equal(reviewModerationSchema.safeParse({autoApprove:'false'}).success,false);
  assert.equal(reviewModerationSchema.safeParse({autoApprove:true,published:true}).success,false);
});
