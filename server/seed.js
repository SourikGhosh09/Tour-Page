import bcrypt from 'bcryptjs';
import { pool, transaction } from './db.js';

const destinations = [
  ['kashmir','Kashmir','Alpine quiet','https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=1600&q=85',46,19],
  ['rajasthan','Rajasthan','Desert light','https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1600&q=85',31,48],
  ['kerala','Kerala','Slow waters','https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=85',47,82]
];

try {
  await transaction(async client => {
    for (const d of destinations) await client.query(`INSERT INTO destinations(slug,name,tagline,image_url,map_x,map_y) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,tagline=excluded.tagline,image_url=excluded.image_url,map_x=excluded.map_x,map_y=excluded.map_y`, d);
    const rows = await client.query('SELECT id,slug FROM destinations');
    const ids = Object.fromEntries(rows.rows.map(r => [r.slug,r.id]));
    const packages = [
      [ids.kashmir,'kashmir-slowly','Kashmir, Slowly','Still lakes, alpine meadows and room to breathe.',8,2490000,destinations[0][3]],
      [ids.rajasthan,'rajasthan-in-gold','Rajasthan in Gold','Fort cities and desert light at an unhurried pace.',7,2150000,destinations[1][3]],
      [ids.kerala,'kerala-by-water','Kerala, By Water','Backwaters, spice country and the slow southern coast.',6,1980000,destinations[2][3]]
    ];
    for (const p of packages) await client.query(`INSERT INTO packages(destination_id,slug,name,summary,duration_days,price_paise,image_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,summary=excluded.summary,duration_days=excluded.duration_days,price_paise=excluded.price_paise,image_url=excluded.image_url`, p);
    await client.query(`INSERT INTO departures(package_id,starts_on,capacity) SELECT id,CURRENT_DATE + 45,24 FROM packages ON CONFLICT(package_id,starts_on) DO NOTHING`);
    await client.query(`INSERT INTO site_settings(key,value) VALUES('motion','{"intensity":"cinematic","intro":true,"parallax":true,"pageTransitions":true}') ON CONFLICT(key) DO NOTHING`);
    await client.query(`INSERT INTO site_settings(key,value) VALUES('businessProfile',$1) ON CONFLICT(key) DO NOTHING`,[JSON.stringify({businessName:'Ghure Ashi Tour & Travels',tagline:'Your journey. Our responsibility.',primaryPhone:'7980240895',secondaryPhone:'9062964425',whatsappPhone:'7980240895',email:'',address:'Domjur, Howrah',officeHours:'Every day, 9 AM–8 PM',logoUrl:'/images/ghure-ashi-logo.png'})]);
    const scenes=[['hero','A journey begins within.','Curated journeys across India','Come away from the familiar. We will take care of everything after that.',0,'ROUTE'],['discover','Which way calls you?','The world opens','Every direction holds a different version of you.',1,'PINNED'],['journeys','Seven days. A thousand moments.','Explore the journey','Follow the route from still water to golden valleys.',2,'HORIZONTAL'],['booking','Where should we go next?','The journey becomes yours','Tell us what you imagine. We will turn it into a journey.',3,'IMAGE_REVEAL']];
    for(const scene of scenes) await client.query(`INSERT INTO story_scenes(scene_key,heading,subheading,description,display_order,animation_preset) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(scene_key) DO NOTHING`,scene);
    const email = (process.env.ADMIN_EMAIL || 'admin@ghureashi.example').toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await client.query(`INSERT INTO admins(email,password_hash,display_name,role,permissions,active) VALUES($1,$2,'Master Admin','master','[]',true) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,display_name='Master Admin',role='master',active=true`, [email,hash]);
    }
  });
  console.log('Seed complete. Admin created only when ADMIN_PASSWORD was provided.');
} finally { await pool.end(); }
