import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { del, head, put } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import 'dotenv/config';
import { query, transaction } from './db.js';
import { bookingSchema, bookingStatusSchema, businessProfileSchema, departureSchema, destinationSchema, gallerySchema, guestReviewSchema, loginSchema, motionSchema, packageSchema, reviewSchema, sceneSchema, staffCreateSchema, staffUpdateSchema, validate } from './validation.js';
import { clearSession, createSession, requireAdmin, requireMaster, requirePermission } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const origin = process.env.APP_ORIGIN || (process.env.VERCEL ? '' : 'http://localhost:5173');
const defaultBusinessProfile={businessName:'Ghure Ashi Tour & Travels',tagline:'Your journey. Our responsibility.',primaryPhone:'7980240895',secondaryPhone:'9062964425',whatsappPhone:'7980240895',email:'',address:'Domjur, Howrah',officeHours:'Every day, 9 AM–8 PM',logoUrl:'/images/ghure-ashi-logo.png'};
const blobStorageEnabled=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const uploadDir=path.resolve(process.env.UPLOAD_DIR||'uploads');
if(!blobStorageEnabled)mkdirSync(uploadDir,{recursive:true});
const allowedMedia=new Map([['image/jpeg','.jpg'],['image/png','.png'],['image/webp','.webp'],['video/mp4','.mp4'],['video/webm','.webm']]);
const storageFor=filename=>blobStorageEnabled?multer.memoryStorage():multer.diskStorage({destination:uploadDir,filename});
const upload=multer({storage:storageFor((_req,file,done)=>done(null,`${crypto.randomUUID()}${allowedMedia.get(file.mimetype)}`)),limits:{fileSize:25*1024*1024,files:5,fields:10},fileFilter:(_req,file,done)=>allowedMedia.has(file.mimetype)?done(null,true):done(new multer.MulterError('LIMIT_UNEXPECTED_FILE','media'))});
const allowedLogoMedia=new Map([['image/jpeg','.jpg'],['image/png','.png'],['image/webp','.webp']]);
const logoUpload=multer({storage:storageFor((_req,file,done)=>done(null,`logo-${crypto.randomUUID()}${allowedLogoMedia.get(file.mimetype)}`)),limits:{fileSize:5*1024*1024,files:1,fields:0},fileFilter:(_req,file,done)=>allowedLogoMedia.has(file.mimetype)?done(null,true):done(new multer.MulterError('LIMIT_UNEXPECTED_FILE','logo'))});
const isVercelBlobUrl=value=>{try{return new URL(value).hostname.endsWith('.blob.vercel-storage.com');}catch{return false;}};
const removeStoredMedia=mediaUrls=>Promise.all(mediaUrls.filter(url=>typeof url==='string').map(url=>{
  if(url.startsWith('/uploads/'))return unlink(path.join(uploadDir,path.basename(url))).catch(()=>{});
  if(blobStorageEnabled&&isVercelBlobUrl(url))return del(url).catch(()=>{});
  return Promise.resolve();
}));
const cleanupIncomingFiles=files=>Promise.all(files.filter(file=>file.path).map(file=>unlink(file.path).catch(()=>{})));
const persistUploadedFile=async(file,prefix,extensions)=>{
  if(!blobStorageEnabled)return `/uploads/${file.filename}`;
  const pathname=`${prefix}/${crypto.randomUUID()}${extensions.get(file.mimetype)}`;
  const blob=await put(pathname,file.buffer,{access:'public',contentType:file.mimetype,addRandomSuffix:false});
  return blob.url;
};
const hasMediaSignature=(mime,bytes)=>({
  'image/jpeg':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,
  'image/png':bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),
  'image/webp':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',
  'video/mp4':bytes.subarray(4,8).toString()==='ftyp',
  'video/webm':bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
})[mime]===true;
const verifyUploadedMedia=async files=>{for(const file of files){let bytes=file.buffer?.subarray(0,16);let handle;if(!bytes){handle=await open(file.path,'r');bytes=Buffer.alloc(16);await handle.read(bytes,0,bytes.length,0);}try{if(!hasMediaSignature(file.mimetype,bytes)){const err=new Error('One upload does not match its declared photo or video format.');err.status=422;err.code='INVALID_MEDIA';throw err;}}finally{if(handle)await handle.close();}}};
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {directives:{imgSrc:["'self'",'data:','https:'],mediaSrc:["'self'",'https:']}} : false, crossOriginResourcePolicy: { policy:'cross-origin' } }));
if(origin)app.use(cors({ origin, credentials:true }));
app.use(express.json({ limit:'100kb' }));
app.use(cookieParser());
if(!blobStorageEnabled)app.use('/uploads',express.static(uploadDir,{maxAge:'7d',index:false,fallthrough:false}));

const apiLimit = rateLimit({ windowMs:60_000, limit:120, standardHeaders:true, legacyHeaders:false });
const authLimit = rateLimit({ windowMs:15*60_000, limit:10, standardHeaders:true, legacyHeaders:false });
const reviewLimit = rateLimit({ windowMs:60*60_000, limit:5, standardHeaders:true, legacyHeaders:false });
const reviewUploadLimit = rateLimit({ windowMs:60*60_000, limit:20, standardHeaders:true, legacyHeaders:false });
app.use('/api', apiLimit);

app.get('/api/health', async (_req,res,next) => { try { await query('SELECT 1'); res.json({ status:'ok' }); } catch(e){ next(e); } });
app.get('/api/catalog', async (_req,res,next) => { try {
  const [destinations, packages, settings, profileSettings, scenes] = await Promise.all([
    query('SELECT slug,name,tagline,image_url AS "image",map_x::float AS x,map_y::float AS y FROM destinations WHERE published ORDER BY name'),
    query(`SELECT p.id,p.slug,p.name,p.summary,p.duration_days AS "durationDays",p.price_paise AS "pricePaise",p.image_url AS image,d.id AS "departureId",d.starts_on AS "startsOn",d.capacity-d.seats_reserved AS "seatsLeft" FROM packages p JOIN LATERAL (SELECT * FROM departures WHERE package_id=p.id AND status='open' AND starts_on>=CURRENT_DATE ORDER BY starts_on LIMIT 1) d ON true WHERE p.published ORDER BY p.created_at`),
    query("SELECT value FROM site_settings WHERE key='motion'"), query("SELECT value FROM site_settings WHERE key='businessProfile'"), query('SELECT scene_key AS key,heading,subheading,description,primary_image AS "primaryImage",cta_text AS "ctaText",cta_href AS "ctaHref",display_order AS "displayOrder",visible,animation_preset AS "animationPreset" FROM story_scenes ORDER BY display_order')
  ]);
  res.json({ destinations:destinations.rows, packages:packages.rows, motion:settings.rows[0]?.value || {intensity:'standard',intro:true,parallax:true,pageTransitions:true}, businessProfile:{...defaultBusinessProfile,...profileSettings.rows[0]?.value}, scenes:scenes.rows });
} catch(e){ next(e); } });

app.get('/api/reviews',async(_req,res,next)=>{try{const r=await query(`SELECT r.id,r.traveller_name AS "travellerName",r.destination,r.travelled_on AS "travelledOn",r.rating,r.quote,r.image_url AS "imageUrl",r.verified,r.created_at AS "createdAt",COALESCE(json_agg(json_build_object('id',m.id,'type',m.media_type,'url',m.media_url,'mimeType',m.mime_type,'displayOrder',m.display_order) ORDER BY m.display_order) FILTER(WHERE m.id IS NOT NULL),'[]') AS media FROM reviews r LEFT JOIN review_media m ON m.review_id=r.id WHERE r.published=true AND r.deleted_at IS NULL GROUP BY r.id ORDER BY r.created_at DESC LIMIT 30`);res.json({reviews:r.rows});}catch(e){next(e);}});
app.get('/api/review-uploads/mode',(_req,res)=>res.json({mode:blobStorageEnabled?'blob':'multipart'}));
app.post('/api/review-uploads',reviewUploadLimit,async(req,res)=>{if(!blobStorageEnabled)return res.status(404).json({error:{code:'BLOB_DISABLED',message:'Direct uploads are not enabled.'}});try{const response=await handleUpload({body:req.body,request:req,onBeforeGenerateToken:async pathname=>{if(!/^reviews\/[a-zA-Z0-9._-]+$/.test(pathname))throw new Error('Invalid review upload path.');return{allowedContentTypes:[...allowedMedia.keys()],maximumSizeInBytes:25*1024*1024,addRandomSuffix:true,tokenPayload:JSON.stringify({purpose:'guest-review'})};},onUploadCompleted:async()=>{}});res.json(response);}catch(error){res.status(400).json({error:{code:'UPLOAD_TOKEN_ERROR',message:error.message||'The upload could not be authorized.'}});}});
app.post('/api/reviews',reviewLimit,upload.array('media',5),async(req,res,next)=>{
  let storedMedia=[];
  const cleanup=async()=>{await cleanupIncomingFiles(req.files||[]);await removeStoredMedia(storedMedia);};
  try{
    await verifyUploadedMedia(req.files||[]);
    const directMedia=Array.isArray(req.body?.media)?req.body.media:[];
    const reviewFields={...req.body};delete reviewFields.media;
    const parsed=guestReviewSchema.safeParse(reviewFields);
    if(!parsed.success){await cleanup();return res.status(422).json({error:{code:'VALIDATION_ERROR',message:'Some review fields need attention.',fields:parsed.error.flatten().fieldErrors}});}
    if(directMedia.length&&(!blobStorageEnabled||directMedia.length>5))return res.status(422).json({error:{code:'INVALID_MEDIA',message:'Upload up to five approved photos or videos.'}});
    const mediaRows=[];
    if(directMedia.length){
      for(const item of directMedia){
        if(!item||typeof item.url!=='string'||typeof item.mimeType!=='string'||!isVercelBlobUrl(item.url)||!allowedMedia.has(item.mimeType))throw Object.assign(new Error('One uploaded file is invalid.'),{status:422,code:'INVALID_MEDIA'});
        const metadata=await head(item.url);
        if(!metadata.pathname.startsWith('reviews/')||metadata.contentType!==item.mimeType||metadata.size>25*1024*1024)throw Object.assign(new Error('One uploaded file is invalid.'),{status:422,code:'INVALID_MEDIA'});
        storedMedia.push(item.url);
        mediaRows.push({url:item.url,mimeType:item.mimeType,originalName:String(item.originalName||'guest-upload').slice(0,255)});
      }
    }else{
      for(const file of req.files||[]){const url=await persistUploadedFile(file,'reviews',allowedMedia);storedMedia.push(url);mediaRows.push({url,mimeType:file.mimetype,originalName:file.originalname.slice(0,255)});}
    }
    const d=parsed.data;
    const review=await transaction(async client=>{const r=await client.query(`INSERT INTO reviews(traveller_name,guest_email,destination,travelled_on,rating,quote,verified,published) VALUES($1,$2,$3,$4,$5,$6,false,false) RETURNING id`,[d.travellerName,d.guestEmail,d.destination,d.travelledOn,d.rating,d.quote]);for(let i=0;i<mediaRows.length;i++){const media=mediaRows[i];await client.query(`INSERT INTO review_media(review_id,media_type,media_url,mime_type,original_name,display_order) VALUES($1,$2,$3,$4,$5,$6)`,[r.rows[0].id,media.mimeType.startsWith('video/')?'video':'image',media.url,media.mimeType,media.originalName,i]);}return r.rows[0];});
    res.status(201).json({id:review.id,message:'Thank you. Your memory was sent for review.'});
  }catch(e){await cleanup();next(e);}
});

app.post('/api/bookings', validate(bookingSchema), async (req,res,next) => { try {
  const data=req.validated;
  const booking=await transaction(async client => {
    const departureResult=await client.query(`SELECT d.id,d.capacity,d.seats_reserved,COALESCE(d.price_paise,p.price_paise) AS price_paise FROM departures d JOIN packages p ON p.id=d.package_id WHERE d.id=$1 AND d.status='open' AND d.starts_on>=CURRENT_DATE FOR UPDATE`,[data.departureId]);
    const departure=departureResult.rows[0];
    if(!departure) { const err=new Error('Departure unavailable'); err.status=409; err.code='DEPARTURE_UNAVAILABLE'; throw err; }
    if(departure.capacity-departure.seats_reserved < data.travellers.length) { const err=new Error('Not enough seats'); err.status=409; err.code='INSUFFICIENT_SEATS'; throw err; }
    const reference=`GA-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const amount=Number(departure.price_paise)*data.travellers.length;
    const inserted=await client.query(`INSERT INTO bookings(reference,departure_id,customer_name,customer_email,customer_phone,traveller_count,amount_paise) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,reference,status,amount_paise AS "amountPaise"`,[reference,data.departureId,data.customerName,data.customerEmail,data.customerPhone,data.travellers.length,amount]);
    for(let i=0;i<data.travellers.length;i++){const t=data.travellers[i];await client.query('INSERT INTO travellers(booking_id,full_name,age,traveller_type,position) VALUES($1,$2,$3,$4,$5)',[inserted.rows[0].id,t.fullName,t.age,t.type,i]);}
    await client.query('UPDATE departures SET seats_reserved=seats_reserved+$1 WHERE id=$2',[data.travellers.length,data.departureId]);
    return inserted.rows[0];
  });
  res.status(201).location(`/api/bookings/${booking.reference}`).json({ booking, payment:{ mode:'provider-required', message:'Connect Razorpay credentials to accept live payment.' } });
} catch(e){ next(e); } });

app.post('/api/admin/login', authLimit, validate(loginSchema), async (req,res,next) => { try { const result=await query('SELECT id,email,password_hash,display_name AS "displayName",role,permissions,active FROM admins WHERE email=$1',[req.validated.email]); const admin=result.rows[0]; const valid=admin?.active && await bcrypt.compare(req.validated.password,admin.password_hash); if(!valid) return res.status(401).json({error:{code:'INVALID_CREDENTIALS',message:'Email or password is incorrect.'}}); await query('UPDATE admins SET last_login_at=now() WHERE id=$1',[admin.id]);await query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id) VALUES($1,'LOGIN','admin',$2)`,[admin.id,admin.id]);createSession(res,admin); res.json({admin:{id:admin.id,email:admin.email,displayName:admin.displayName,role:admin.role,permissions:admin.permissions}}); } catch(e){next(e);} });
app.post('/api/admin/logout', (_req,res)=>{clearSession(res);res.status(204).end();});
app.get('/api/admin/session', requireAdmin, (req,res)=>res.json({admin:req.admin}));
app.get('/api/admin/data', requireAdmin, async (req,res,next)=>{try{
  const [destinations,packagesResult,departures,bookings,scenes,gallery,reviews,settings,profileSettings]=await Promise.all([
    query('SELECT id,slug,name,tagline,image_url AS "imageUrl",map_x::float AS "mapX",map_y::float AS "mapY",published FROM destinations ORDER BY name'),
    query('SELECT id,destination_id AS "destinationId",slug,name,summary,duration_days AS "durationDays",price_paise AS "pricePaise",image_url AS "imageUrl",published FROM packages ORDER BY created_at DESC'),
    query(`SELECT d.id,d.package_id AS "packageId",p.name AS package,d.starts_on AS "startsOn",d.capacity,d.seats_reserved AS "seatsReserved",d.capacity-d.seats_reserved AS "seatsLeft",d.price_paise AS "pricePaise",d.status FROM departures d JOIN packages p ON p.id=d.package_id ORDER BY d.starts_on DESC`),
    query(`SELECT b.id,b.reference,b.departure_id AS "departureId",b.customer_name AS "customerName",b.customer_email AS "customerEmail",b.customer_phone AS "customerPhone",b.traveller_count AS "travellerCount",b.amount_paise AS "amountPaise",b.status,b.payment_provider AS "paymentProvider",b.payment_reference AS "paymentReference",b.created_at AS "createdAt",p.name AS package,COALESCE(json_agg(json_build_object('id',t.id,'fullName',t.full_name,'age',t.age,'type',t.traveller_type,'position',t.position) ORDER BY t.position) FILTER (WHERE t.id IS NOT NULL),'[]') AS travellers FROM bookings b JOIN departures d ON d.id=b.departure_id JOIN packages p ON p.id=d.package_id LEFT JOIN travellers t ON t.booking_id=b.id GROUP BY b.id,p.name ORDER BY b.created_at DESC LIMIT 200`),
    query(`SELECT id,scene_key AS key,heading,subheading,description,primary_image AS "primaryImage",secondary_image AS "secondaryImage",background_video AS "backgroundVideo",cta_text AS "ctaText",cta_href AS "ctaHref",linked_package_id AS "linkedPackageId",linked_destination_id AS "linkedDestinationId",display_order AS "displayOrder",visible,animation_preset AS "animationPreset",updated_at AS "updatedAt" FROM story_scenes ORDER BY display_order`),
    query('SELECT id,destination_id AS "destinationId",title,image_url AS "imageUrl",alt_text AS "altText",display_order AS "displayOrder",published FROM gallery_items ORDER BY display_order'),
    query(`SELECT r.id,r.traveller_name AS "travellerName",r.guest_email AS "guestEmail",r.destination,r.travelled_on AS "travelledOn",r.rating,r.quote,r.image_url AS "imageUrl",r.verified,r.published,r.created_at AS "createdAt",COALESCE(json_agg(json_build_object('id',m.id,'type',m.media_type,'url',m.media_url,'mimeType',m.mime_type,'displayOrder',m.display_order) ORDER BY m.display_order) FILTER(WHERE m.id IS NOT NULL),'[]') AS media FROM reviews r LEFT JOIN review_media m ON m.review_id=r.id WHERE r.deleted_at IS NULL GROUP BY r.id ORDER BY r.created_at DESC`),
    query("SELECT value FROM site_settings WHERE key='motion'"),
    query("SELECT value FROM site_settings WHERE key='businessProfile'")
  ]);
  const allowed=name=>req.admin.role==='master'||req.admin.permissions.includes(name);
  res.json({destinations:allowed('destinations')||allowed('packages')||allowed('story')||allowed('media')?destinations.rows:[],packages:allowed('packages')||allowed('departures')||allowed('story')?packagesResult.rows:[],departures:allowed('departures')||allowed('overview')?departures.rows:[],bookings:allowed('bookings')||allowed('overview')?bookings.rows:[],scenes:allowed('story')?scenes.rows:[],gallery:allowed('media')?gallery.rows:[],reviews:allowed('media')?reviews.rows:[],motion:allowed('settings')?settings.rows[0]?.value||{intensity:'standard',intro:true,parallax:true,pageTransitions:true}:{intensity:'standard',intro:false,parallax:false,pageTransitions:false},businessProfile:{...defaultBusinessProfile,...profileSettings.rows[0]?.value}});
}catch(e){next(e);}});
app.get('/api/admin/bookings', requireAdmin, requirePermission('bookings'), async (_req,res,next)=>{try{const result=await query(`SELECT b.reference,b.customer_name AS "customerName",b.customer_email AS "customerEmail",b.traveller_count AS "travellerCount",b.amount_paise AS "amountPaise",b.status,b.created_at AS "createdAt",p.name AS package FROM bookings b JOIN departures d ON d.id=b.departure_id JOIN packages p ON p.id=d.package_id ORDER BY b.created_at DESC LIMIT 100`);res.json({bookings:result.rows});}catch(e){next(e);}});
app.put('/api/admin/settings/motion', requireAdmin, requirePermission('settings'), validate(motionSchema), async(req,res,next)=>{try{await query(`INSERT INTO site_settings(key,value,updated_at) VALUES('motion',$1,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`,[JSON.stringify(req.validated)]);res.json({motion:req.validated});}catch(e){next(e);}});
app.put('/api/admin/settings/business',requireAdmin,requirePermission('settings'),validate(businessProfileSchema),async(req,res,next)=>{try{const current=await query("SELECT value FROM site_settings WHERE key='businessProfile'");const oldLogo=current.rows[0]?.value?.logoUrl;await transaction(async client=>{await client.query(`INSERT INTO site_settings(key,value,updated_at) VALUES('businessProfile',$1,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`,[JSON.stringify(req.validated)]);await client.query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id) VALUES($1,'UPDATE_BUSINESS_PROFILE','site_settings','businessProfile')`,[req.admin.id]);});if(oldLogo?.startsWith('/uploads/logo-')&&oldLogo!==req.validated.logoUrl)await removeStoredMedia([oldLogo]);res.json({businessProfile:req.validated});}catch(e){next(e);}});
app.post('/api/admin/settings/logo',requireAdmin,requirePermission('settings'),logoUpload.single('logo'),async(req,res,next)=>{let storedLogo;const cleanup=async()=>{if(req.file)await cleanupIncomingFiles([req.file]);if(storedLogo)await removeStoredMedia([storedLogo]);};try{if(!req.file)return res.status(422).json({error:{code:'LOGO_REQUIRED',message:'Choose a JPG, PNG or WebP logo.'}});await verifyUploadedMedia([req.file]);storedLogo=await persistUploadedFile(req.file,'logos',allowedLogoMedia);const current=await query("SELECT value FROM site_settings WHERE key='businessProfile'");const oldProfile={...defaultBusinessProfile,...current.rows[0]?.value};const profile={...oldProfile,logoUrl:storedLogo};await transaction(async client=>{await client.query(`INSERT INTO site_settings(key,value,updated_at) VALUES('businessProfile',$1,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`,[JSON.stringify(profile)]);await client.query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id) VALUES($1,'UPDATE_LOGO','site_settings','businessProfile')`,[req.admin.id]);});if(oldProfile.logoUrl!==storedLogo)await removeStoredMedia([oldProfile.logoUrl]);res.status(201).json({logoUrl:profile.logoUrl,businessProfile:profile});}catch(e){await cleanup();next(e);}});
app.put('/api/admin/scenes/:key', requireAdmin, requirePermission('story'), validate(sceneSchema), async(req,res,next)=>{try{const d=req.validated;const result=await query(`INSERT INTO story_scenes(scene_key,heading,subheading,description,primary_image,secondary_image,background_video,cta_text,cta_href,linked_package_id,linked_destination_id,display_order,visible,animation_preset) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(scene_key) DO UPDATE SET heading=excluded.heading,subheading=excluded.subheading,description=excluded.description,primary_image=excluded.primary_image,secondary_image=excluded.secondary_image,background_video=excluded.background_video,cta_text=excluded.cta_text,cta_href=excluded.cta_href,linked_package_id=excluded.linked_package_id,linked_destination_id=excluded.linked_destination_id,display_order=excluded.display_order,visible=excluded.visible,animation_preset=excluded.animation_preset,updated_at=now() RETURNING scene_key AS key,*`,[req.params.key,d.heading,d.subheading,d.description,d.primaryImage,d.secondaryImage,d.backgroundVideo,d.ctaText,d.ctaHref,d.linkedPackageId,d.linkedDestinationId,d.displayOrder,d.visible,d.animationPreset]);res.json({scene:result.rows[0]});}catch(e){next(e);}});

app.post('/api/admin/destinations',requireAdmin,requirePermission('destinations'),validate(destinationSchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`INSERT INTO destinations(slug,name,tagline,image_url,map_x,map_y,published) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[d.slug,d.name,d.tagline,d.imageUrl,d.mapX,d.mapY,d.published]);res.status(201).json({id:r.rows[0].id});}catch(e){next(e);}});
app.put('/api/admin/destinations/:id',requireAdmin,requirePermission('destinations'),validate(destinationSchema),async(req,res,next)=>{try{const d=req.validated;await query(`UPDATE destinations SET slug=$1,name=$2,tagline=$3,image_url=$4,map_x=$5,map_y=$6,published=$7 WHERE id=$8`,[d.slug,d.name,d.tagline,d.imageUrl,d.mapX,d.mapY,d.published,req.params.id]);res.json({ok:true});}catch(e){next(e);}});
app.post('/api/admin/packages',requireAdmin,requirePermission('packages'),validate(packageSchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`INSERT INTO packages(destination_id,slug,name,summary,duration_days,price_paise,image_url,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[d.destinationId,d.slug,d.name,d.summary,d.durationDays,d.pricePaise,d.imageUrl,d.published]);res.status(201).json({id:r.rows[0].id});}catch(e){next(e);}});
app.put('/api/admin/packages/:id',requireAdmin,requirePermission('packages'),validate(packageSchema),async(req,res,next)=>{try{const d=req.validated;await query(`UPDATE packages SET destination_id=$1,slug=$2,name=$3,summary=$4,duration_days=$5,price_paise=$6,image_url=$7,published=$8 WHERE id=$9`,[d.destinationId,d.slug,d.name,d.summary,d.durationDays,d.pricePaise,d.imageUrl,d.published,req.params.id]);res.json({ok:true});}catch(e){next(e);}});
app.post('/api/admin/departures',requireAdmin,requirePermission('departures'),validate(departureSchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`INSERT INTO departures(package_id,starts_on,capacity,price_paise,status) VALUES($1,$2,$3,$4,$5) RETURNING id`,[d.packageId,d.startsOn,d.capacity,d.pricePaise,d.status]);res.status(201).json({id:r.rows[0].id});}catch(e){next(e);}});
app.put('/api/admin/departures/:id',requireAdmin,requirePermission('departures'),validate(departureSchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`UPDATE departures SET package_id=$1,starts_on=$2,capacity=$3,price_paise=$4,status=$5 WHERE id=$6 AND $3>=seats_reserved RETURNING id`,[d.packageId,d.startsOn,d.capacity,d.pricePaise,d.status,req.params.id]);if(!r.rowCount)return res.status(409).json({error:{code:'CAPACITY_CONFLICT',message:'Capacity cannot be lower than reserved seats.'}});res.json({ok:true});}catch(e){next(e);}});
app.patch('/api/admin/bookings/:id/status',requireAdmin,requirePermission('bookings'),validate(bookingStatusSchema),async(req,res,next)=>{try{await query('UPDATE bookings SET status=$1 WHERE id=$2',[req.validated.status,req.params.id]);res.json({ok:true});}catch(e){next(e);}});
app.post('/api/admin/gallery',requireAdmin,requirePermission('media'),validate(gallerySchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`INSERT INTO gallery_items(destination_id,title,image_url,alt_text,display_order,published) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[d.destinationId,d.title,d.imageUrl,d.altText,d.displayOrder,d.published]);res.status(201).json({id:r.rows[0].id});}catch(e){next(e);}});
app.put('/api/admin/gallery/:id',requireAdmin,requirePermission('media'),validate(gallerySchema),async(req,res,next)=>{try{const d=req.validated;await query(`UPDATE gallery_items SET destination_id=$1,title=$2,image_url=$3,alt_text=$4,display_order=$5,published=$6 WHERE id=$7`,[d.destinationId,d.title,d.imageUrl,d.altText,d.displayOrder,d.published,req.params.id]);res.json({ok:true});}catch(e){next(e);}});
app.post('/api/admin/reviews',requireAdmin,requirePermission('media'),validate(reviewSchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`INSERT INTO reviews(traveller_name,destination,travelled_on,rating,quote,image_url,verified,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[d.travellerName,d.destination,d.travelledOn,d.rating,d.quote,d.imageUrl,d.verified,d.published]);res.status(201).json({id:r.rows[0].id});}catch(e){next(e);}});
app.put('/api/admin/reviews/:id',requireAdmin,requirePermission('media'),validate(reviewSchema),async(req,res,next)=>{try{const d=req.validated;const r=await query(`UPDATE reviews SET traveller_name=$1,destination=$2,travelled_on=$3,rating=$4,quote=$5,image_url=$6,verified=$7,published=$8,updated_at=now() WHERE id=$9 AND deleted_at IS NULL RETURNING id`,[d.travellerName,d.destination,d.travelledOn,d.rating,d.quote,d.imageUrl,d.verified,d.published,req.params.id]);if(!r.rowCount)return res.status(404).json({error:{code:'REVIEW_NOT_FOUND',message:'Review not found.'}});await query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id) VALUES($1,'UPDATE_REVIEW','review',$2)`,[req.admin.id,req.params.id]);res.json({ok:true});}catch(e){next(e);}});
app.delete('/api/admin/reviews/:id',requireAdmin,requirePermission('media'),async(req,res,next)=>{try{const deleted=await transaction(async client=>{const media=await client.query('SELECT media_url FROM review_media WHERE review_id=$1',[req.params.id]);const r=await client.query(`UPDATE reviews SET deleted_at=now(),published=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,[req.params.id]);if(!r.rowCount)return null;await client.query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id) VALUES($1,'DELETE_REVIEW','review',$2)`,[req.admin.id,req.params.id]);return media.rows.map(row=>row.media_url);});if(!deleted)return res.status(404).json({error:{code:'REVIEW_NOT_FOUND',message:'Review not found.'}});await removeStoredMedia(deleted);res.status(204).end();}catch(e){next(e);}});

app.get('/api/admin/staff',requireAdmin,requireMaster,async(_req,res,next)=>{try{const r=await query(`SELECT id,display_name AS "displayName",email,permissions,active,last_login_at AS "lastLoginAt",created_at AS "createdAt" FROM admins WHERE role='staff' ORDER BY created_at DESC`);res.json({staff:r.rows});}catch(e){next(e);}});
app.post('/api/admin/staff',requireAdmin,requireMaster,validate(staffCreateSchema),async(req,res,next)=>{try{const d=req.validated;const hash=await bcrypt.hash(d.password,12);const r=await query(`INSERT INTO admins(display_name,email,password_hash,role,permissions,active,created_by) VALUES($1,$2,$3,'staff',$4,$5,$6) RETURNING id`,[d.displayName,d.email,hash,JSON.stringify(d.permissions),d.active,req.admin.id]);await query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'CREATE_STAFF','admin',$2,$3)`,[req.admin.id,r.rows[0].id,JSON.stringify({email:d.email,permissions:d.permissions})]);res.status(201).json({id:r.rows[0].id});}catch(e){if(e.code==='23505')return res.status(409).json({error:{code:'EMAIL_EXISTS',message:'An account with this email already exists.'}});next(e);}});
app.put('/api/admin/staff/:id',requireAdmin,requireMaster,validate(staffUpdateSchema),async(req,res,next)=>{try{const d=req.validated;const params=[d.displayName,d.email,JSON.stringify(d.permissions),d.active,req.params.id];let sql=`UPDATE admins SET display_name=$1,email=$2,permissions=$3,active=$4,updated_at=now() WHERE id=$5 AND role='staff'`;
  if(d.password){const hash=await bcrypt.hash(d.password,12);params.push(hash);sql=`UPDATE admins SET display_name=$1,email=$2,permissions=$3,active=$4,updated_at=now(),password_hash=$6 WHERE id=$5 AND role='staff'`;}
  const r=await query(`${sql} RETURNING id`,params);if(!r.rowCount)return res.status(404).json({error:{code:'STAFF_NOT_FOUND',message:'Staff account not found.'}});await query(`INSERT INTO admin_audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'UPDATE_STAFF','admin',$2,$3)`,[req.admin.id,req.params.id,JSON.stringify({email:d.email,permissions:d.permissions,active:d.active,passwordReset:Boolean(d.password)})]);res.json({ok:true});
}catch(e){if(e.code==='23505')return res.status(409).json({error:{code:'EMAIL_EXISTS',message:'An account with this email already exists.'}});next(e);}});

app.use('/api', (_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'API route not found.'}}));
if(process.env.NODE_ENV==='production'){const here=path.dirname(fileURLToPath(import.meta.url));app.use(express.static(path.join(here,'../dist'),{maxAge:'1y',immutable:true,index:false}));app.use((req,res,next)=>req.method==='GET'?res.sendFile(path.join(here,'../dist/index.html')):next());}
app.use((err,_req,res,_next)=>{console.error(err);if(err instanceof multer.MulterError){const tooLarge=err.code==='LIMIT_FILE_SIZE';const isLogo=err.field==='logo';const message=isLogo?(tooLarge?'The logo must be 5 MB or smaller.':'Choose one JPG, PNG or WebP logo.'):(tooLarge?'Each upload must be 25 MB or smaller.':'Upload up to five JPG, PNG, WebP, MP4 or WebM files.');return res.status(tooLarge?413:422).json({error:{code:err.code,message}});}res.status(err.status||500).json({error:{code:err.code||'INTERNAL_ERROR',message:err.status?err.message:'Something went wrong. Please try again.'}});});
if(!process.env.VERCEL)app.listen(port,()=>console.log(`Ghure Ashi server listening on ${port}`));

export default app;
