import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingSchema, businessProfileSchema, guestReviewMediaSchema, guestReviewSchema, loginSchema, staffCreateSchema } from './validation.js';

test('booking accepts a valid reservation', () => {
  const parsed=bookingSchema.safeParse({departureId:'123e4567-e89b-12d3-a456-426614174000',customerName:'Riya Sen',customerEmail:'riya@example.com',customerPhone:'+91 98765 43210',travellers:[{fullName:'Riya Sen',age:29,type:'adult'}]});
  assert.equal(parsed.success,true);
});
test('booking rejects client-controlled amount and excessive travellers', () => {
  const parsed=bookingSchema.safeParse({departureId:'123e4567-e89b-12d3-a456-426614174000',customerName:'Riya',customerEmail:'r@example.com',customerPhone:'9876543210',amountPaise:1,travellers:Array(13).fill({fullName:'X',age:20,type:'adult'})});
  assert.equal(parsed.success,false);
});
test('login rejects unknown fields and short passwords', () => assert.equal(loginSchema.safeParse({email:'a@example.com',password:'short',role:'admin'}).success,false));
test('staff creation accepts only allowlisted permissions',()=>{
  assert.equal(staffCreateSchema.safeParse({displayName:'Booking Agent',email:'agent@example.com',password:'temporary-pass-123',permissions:['bookings','departures'],active:true}).success,true);
  assert.equal(staffCreateSchema.safeParse({displayName:'Intruder',email:'x@example.com',password:'temporary-pass-123',permissions:['staff','master'],active:true}).success,false);
});
test('guest review accepts a valid moderated submission',()=>{
  const parsed=guestReviewSchema.safeParse({travellerName:'Riya Sen',guestEmail:'riya@example.com',destination:'Kashmir',travelledOn:'2026-06-10',rating:'5',quote:'A beautifully planned journey.',website:''});
  assert.equal(parsed.success,true);
  assert.equal(parsed.data.rating,5);
});
test('guest review rejects spam honeypot and invalid ratings',()=>{
  assert.equal(guestReviewSchema.safeParse({travellerName:'Bot',guestEmail:'bot@example.com',destination:'Goa',travelledOn:'',rating:'9',quote:'Spam review',website:'https://spam.invalid'}).success,false);
});

test('guest review media accepts only approved Vercel Blob review assets',()=>{
  const valid=guestReviewMediaSchema.safeParse([{url:'https://store.public.blob.vercel-storage.com/reviews/trip-photo.jpg',mimeType:'image/jpeg',originalName:'trip.jpg'}]);
  assert.equal(valid.success,true);
  assert.equal(guestReviewMediaSchema.safeParse([{url:'https://example.com/reviews/trip-photo.jpg',mimeType:'image/jpeg',originalName:'trip.jpg'}]).success,false);
  assert.equal(guestReviewMediaSchema.safeParse([{url:'https://store.public.blob.vercel-storage.com/logos/logo.jpg',mimeType:'image/jpeg',originalName:'logo.jpg'}]).success,false);
});
test('business profile accepts contact details and a managed logo',()=>{
  const parsed=businessProfileSchema.safeParse({businessName:'Ghure Ashi Tour & Travels',tagline:'Your journey. Our responsibility.',primaryPhone:'+91 79802 40895',secondaryPhone:'',whatsappPhone:'7980240895',email:'hello@ghureashi.example',address:'Domjur, Howrah',officeHours:'Every day, 9 AM–8 PM',logoUrl:'/uploads/logo-123e4567-e89b-12d3-a456-426614174000.png'});
  assert.equal(parsed.success,true);
});
test('business profile rejects executable and insecure logo URLs',()=>{
  const base={businessName:'Ghure Ashi',tagline:'Travel well.',primaryPhone:'7980240895',secondaryPhone:'',whatsappPhone:'',email:'',address:'Howrah',officeHours:'',logoUrl:'javascript:alert(1)'};
  assert.equal(businessProfileSchema.safeParse(base).success,false);
  assert.equal(businessProfileSchema.safeParse({...base,logoUrl:'http://example.com/logo.png'}).success,false);
});
