import { z } from 'zod';

const cleanText = (max) => z.string().trim().min(1).max(max);
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(128) }).strict();
export const bookingSchema = z.object({
  departureId: z.string().uuid(), customerName: cleanText(100), customerEmail: z.string().trim().toLowerCase().email().max(254),
  customerPhone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/),
  travellers: z.array(z.object({ fullName: cleanText(100), age: z.coerce.number().int().min(1).max(120), type: z.enum(['adult','child']) }).strict()).min(1).max(12)
}).strict();
export const motionSchema = z.object({ intensity: z.enum(['low','standard','cinematic']), intro: z.boolean(), parallax: z.boolean(), pageTransitions: z.boolean() }).strict();
const optionalEmail=z.union([z.string().trim().toLowerCase().email().max(254),z.literal('')]);
const optionalPhone=z.union([z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/),z.literal('')]);
const logoAsset=z.string().trim().max(2000).refine(value=>/^https:\/\//i.test(value)||/^\/uploads\/logo-[a-f0-9-]+\.(jpg|png|webp)$/i.test(value)||value==='/images/ghure-ashi-logo.png','Use an HTTPS image URL or upload a logo.');
export const businessProfileSchema=z.object({businessName:cleanText(120),tagline:cleanText(180),primaryPhone:optionalPhone,secondaryPhone:optionalPhone,whatsappPhone:optionalPhone,email:optionalEmail,address:cleanText(240),officeHours:z.string().trim().max(160),logoUrl:logoAsset}).strict();
const nullableUrl = z.union([z.string().url().max(2000),z.literal(''),z.null()]).transform(v=>v||null);
const nullableUuid = z.union([z.string().uuid(),z.literal(''),z.null()]).transform(v=>v||null);
export const sceneSchema = z.object({ heading: cleanText(160), subheading: z.string().trim().max(160), description: z.string().trim().max(800), primaryImage: nullableUrl, secondaryImage: nullableUrl.optional().default(null), backgroundVideo: nullableUrl.optional().default(null), ctaText: z.union([z.string().trim().max(80),z.null()]), ctaHref: z.union([z.string().trim().max(300),z.null()]), linkedPackageId: nullableUuid.optional().default(null), linkedDestinationId: nullableUuid.optional().default(null), displayOrder: z.number().int().min(0).max(1000), visible: z.boolean(), animationPreset: z.enum(['FADE','PARALLAX','IMAGE_REVEAL','ROUTE','PINNED','HORIZONTAL','MINIMAL']) }).strict();
export const destinationSchema=z.object({slug:z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(80),name:cleanText(100),tagline:cleanText(160),imageUrl:z.string().url().max(2000),mapX:z.coerce.number().min(0).max(100),mapY:z.coerce.number().min(0).max(100),published:z.boolean()}).strict();
export const packageSchema=z.object({destinationId:z.string().uuid(),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(80),name:cleanText(120),summary:cleanText(800),durationDays:z.coerce.number().int().min(1).max(90),pricePaise:z.coerce.number().int().min(0),imageUrl:z.string().url().max(2000),published:z.boolean()}).strict();
export const departureSchema=z.object({packageId:z.string().uuid(),startsOn:z.string().date(),capacity:z.coerce.number().int().min(1).max(500),pricePaise:z.union([z.coerce.number().int().min(0),z.null()]),status:z.enum(['open','closed','cancelled'])}).strict();
export const bookingStatusSchema=z.object({status:z.enum(['pending','confirmed','cancelled','expired'])}).strict();
export const gallerySchema=z.object({destinationId:nullableUuid,title:cleanText(120),imageUrl:z.string().url().max(2000),altText:cleanText(240),displayOrder:z.coerce.number().int().min(0).max(1000),published:z.boolean()}).strict();
export const reviewSchema=z.object({travellerName:cleanText(100),destination:cleanText(100),travelledOn:z.union([z.string().date(),z.literal(''),z.null()]).transform(v=>v||null),rating:z.coerce.number().int().min(1).max(5),quote:cleanText(1200),imageUrl:nullableUrl,verified:z.boolean(),published:z.boolean()}).strict();
export const guestReviewSchema=z.object({travellerName:cleanText(100),guestEmail:z.string().trim().toLowerCase().email().max(254),destination:cleanText(100),travelledOn:z.union([z.string().date(),z.literal(''),z.null()]).transform(v=>v||null),rating:z.coerce.number().int().min(1).max(5),quote:cleanText(1200),website:z.string().max(0).optional().default('')}).strict();
export const guestReviewMediaSchema=z.array(z.object({url:z.string().url().max(2000).refine(value=>{try{const parsed=new URL(value);return parsed.protocol==='https:'&&parsed.hostname.endsWith('.blob.vercel-storage.com')&&parsed.pathname.startsWith('/reviews/');}catch{return false;}},'Use an approved review upload.'),mimeType:z.enum(['image/jpeg','image/png','image/webp','video/mp4','video/webm']),originalName:z.string().trim().min(1).max(255)}).strict()).max(5);
export const staffPermissions=['overview','bookings','destinations','packages','departures','story','media','settings'];
export const staffCreateSchema=z.object({displayName:cleanText(100),email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(10).max(128),permissions:z.array(z.enum(staffPermissions)).max(staffPermissions.length),active:z.boolean()}).strict();
export const staffUpdateSchema=z.object({displayName:cleanText(100),email:z.string().trim().toLowerCase().email().max(254),password:z.union([z.string().min(10).max(128),z.literal('')]).optional().default(''),permissions:z.array(z.enum(staffPermissions)).max(staffPermissions.length),active:z.boolean()}).strict();

export function validate(schema) { return (req,res,next) => { const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(422).json({ error: { code:'VALIDATION_ERROR', message:'Some fields need attention.', fields: parsed.error.flatten().fieldErrors } }); req.validated = parsed.data; next(); }; }
