import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { upload as uploadBlob } from '@vercel/blob/client';
import { ArrowDown, ArrowLeft, ArrowRight, Camera, Check, Compass, Headphones, Hotel, LoaderCircle, Lock, MapPin, Menu, Palmtree, Phone, Plane, Search, Settings, ShieldCheck, Star, Train, Upload, Users, Video, X } from 'lucide-react';
import './styles.css';
const AdminControlRoom=lazy(()=>import('./admin/AdminApp.jsx'));

gsap.registerPlugin(ScrollTrigger);

const destinations = [
  { id: 'kashmir', name: 'Kashmir', x: 46, y: 19, tag: 'Alpine quiet', image: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=1600&q=85' },
  { id: 'rajasthan', name: 'Rajasthan', x: 31, y: 48, tag: 'Desert light', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1600&q=85' },
  { id: 'sikkim', name: 'Sikkim', x: 77, y: 44, tag: 'Himalayan air', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1600&q=85' },
  { id: 'kerala', name: 'Kerala', x: 47, y: 82, tag: 'Slow waters', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=85' },
];

const stops = [
  { day: '01', place: 'Srinagar', note: 'Arrive where the mountains meet the mirror-still lake.', image: 'https://images.unsplash.com/photo-1566837497312-7be4a00cee09?auto=format&fit=crop&w=1600&q=85' },
  { day: '03', place: 'Gulmarg', note: 'Climb into meadows held between earth and cloud.', image: 'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1600&q=85' },
  { day: '05', place: 'Pahalgam', note: 'Follow the river into a quieter rhythm.', image: 'https://images.unsplash.com/photo-1621232082074-1a7750ecc557?auto=format&fit=crop&w=1600&q=85' },
  { day: '07', place: 'Sonamarg', note: 'Watch the valley turn gold at the edge of evening.', image: 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b?auto=format&fit=crop&w=1600&q=85' },
];

const packages = [
  { name: 'Kashmir, Slowly', meta: '8 days · 12 seats', price: '₹24,900', image: stops[0].image },
  { name: 'Rajasthan in Gold', meta: '7 days · 8 seats', price: '₹21,500', image: destinations[1].image },
  { name: 'Kerala, By Water', meta: '6 days · 15 seats', price: '₹19,800', image: destinations[3].image },
];

function useGsapScene(scope, setup, deps = []) {
  useLayoutEffect(() => {
    const ctx = gsap.context(setup, scope);
    return () => ctx.revert();
  }, deps);
}

function MagneticButton({ children, className = '', onClick, href = '#packages' }) {
  const ref = useRef(null);
  const move = (e) => {
    if (!matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = ref.current.getBoundingClientRect();
    gsap.to(ref.current, { x: (e.clientX - r.left - r.width / 2) * .16, y: (e.clientY - r.top - r.height / 2) * .16, duration: .3 });
  };
  const reset = () => gsap.to(ref.current, { x: 0, y: 0, duration: .55, ease: 'elastic.out(1,.4)' });
  return <a ref={ref} className={`magnetic ${className}`} href={href} onClick={onClick} onMouseMove={move} onMouseLeave={reset}>{children}<ArrowRight size={17} /></a>;
}

function Header({ openSearch, profile }) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(scrollY > 80);
    update(); addEventListener('scroll', update, { passive: true });
    return () => removeEventListener('scroll', update);
  }, []);
  return <header className={scrolled ? 'site-header compact' : 'site-header'}>
    <a className="brand brand-image" href="#top" aria-label={`${profile.businessName} home`}><img src={profile.logoUrl} alt={profile.businessName}/></a>
    <nav className={menu ? 'nav open' : 'nav'} aria-label="Primary navigation">
      <a href="#discover" onClick={() => setMenu(false)}>Destinations</a><a href="#packages" onClick={() => setMenu(false)}>Journeys</a><a href="#why" onClick={() => setMenu(false)}>Our way</a><a href="#memories" onClick={() => setMenu(false)}>Memories</a>
    </nav>
    <div className="header-actions"><button className="icon-button" onClick={openSearch} aria-label="Search journeys"><Search size={19}/></button><a href="#book" className="book-small">Book a journey</a><button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">{menu ? <X/> : <Menu/>}</button></div>
  </header>;
}

function SearchOverlay({ open, close }) {
  const [query, setQuery] = useState('');
  const results = packages.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (!open) return; const esc = e => e.key === 'Escape' && close(); addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [open]);
  if (!open) return null;
  return <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search journeys"><button className="search-close" onClick={close} aria-label="Close search"><X/></button><div className="search-inner"><span className="eyebrow">Where is your heart going?</span><label><Search/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Kashmir…" /></label><div className="search-results">{results.map(p => <a href="#packages" onClick={close} key={p.name}><span>{p.name}</span><small>{p.meta} · {p.price}</small><ArrowRight/></a>)}{query && !results.length && <p>No journey found yet. Try a destination.</p>}</div></div></div>;
}

function Hero() {
  const root = useRef(null);
  useGsapScene(root, () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top top', end: '+=130%', scrub: 1, pin: true } });
    tl.to('.hero-title', { scale: 1.35, opacity: .05, y: -80 }, 0).to('.hero-land', { scale: 1.18, yPercent: 8 }, 0).to('.hero-sky', { yPercent: 12 }, 0).to('.route-stroke', { strokeDashoffset: 0 }, 0).to('.hero-copy', { opacity: 0, y: -30 }, .1).to('.hero-portal', { clipPath: 'circle(80% at 50% 50%)', duration: .8 }, .25);
  });
  return <section id="top" ref={root} className="hero scene"><div className="hero-sky"></div><div className="stars"></div><div className="hero-portal"></div><div className="hero-land land-back"></div><div className="hero-land land-front"></div><svg className="hero-route" viewBox="0 0 1200 600" aria-hidden="true"><path className="route-stroke" pathLength="1" d="M90 500 C280 470 230 300 430 340 S680 480 760 270 S1010 120 1140 80"/></svg><div className="hero-copy"><span className="eyebrow">Curated journeys across India</span><h1 className="hero-title">A journey<br/><i>begins within.</i></h1><p>Come away from the familiar. We’ll take care of everything after that.</p><MagneticButton>Begin your journey</MagneticButton></div><div className="scroll-cue"><span>Scroll to travel</span><ArrowDown size={16}/></div></section>;
}

function DestinationMap() {
  const root = useRef(null); const [active, setActive] = useState(destinations[0]);
  useGsapScene(root, () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.from('.discover-heading > *', { y: 70, opacity: 0, stagger: .12, scrollTrigger: { trigger: root.current, start: 'top 70%', end: 'top 25%', scrub: 1 } });
    gsap.fromTo('.map-route', { strokeDashoffset: 1 }, { strokeDashoffset: 0, scrollTrigger: { trigger: '.map-stage', start: 'top 70%', end: 'bottom 65%', scrub: 1 } });
  });
  return <section id="discover" ref={root} className="discover scene" style={{'--active-image': `url(${active.image})`}}><div className="discover-bg"></div><div className="discover-heading"><span className="eyebrow">The world opens</span><h2>Which way<br/><i>calls you?</i></h2><p>Touch a point on the map. Every direction holds a different version of you.</p></div><div className="map-stage"><svg className="india-shape" viewBox="0 0 500 620" aria-label="Interactive destination map of India"><path className="country" d="M166 18l76 12 28 45 67 18 21 53 54 43-21 60 45 71-50 35-25 84-52 41-9 65-48 57-39-67-51-52-17-79-65-36 32-66-44-54 30-58-18-54 63-33z"/><path pathLength="1" className="map-route" d="M215 115 C120 190 180 320 155 360 S250 450 230 535"/></svg>{destinations.map(d => <button key={d.id} className={`marker ${active.id === d.id ? 'active' : ''}`} style={{left: `${d.x}%`, top: `${d.y}%`}} onMouseEnter={() => setActive(d)} onFocus={() => setActive(d)} onClick={() => setActive(d)} aria-label={`Explore ${d.name}`}><span></span><b>{d.name}</b></button>)}<div className="map-preview"><span>Now calling</span><strong>{active.name}</strong><small>{active.tag}</small></div></div><div className="destination-list" aria-label="Destinations">{destinations.map(d => <button onClick={() => setActive(d)} className={active.id === d.id ? 'active' : ''} key={d.id}>{d.name}</button>)}</div></section>;
}

function HorizontalJourney() {
  const root = useRef(null); const track = useRef(null);
  useGsapScene(root, () => {
    if (innerWidth < 800 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const amount = () => -(track.current.scrollWidth - innerWidth);
    gsap.to(track.current, { x: amount, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: () => `+=${track.current.scrollWidth - innerWidth}`, scrub: .8, pin: true, invalidateOnRefresh: true } });
  });
  return <section ref={root} className="journey scene"><div className="journey-track" ref={track}><article className="journey-intro"><span className="eyebrow">Explore the journey</span><h2>Seven days.<br/><i>A thousand moments.</i></h2><p>Follow the route from still water to golden valleys.</p><div className="horizontal-hint"><ArrowRight/> Scroll to move east</div></article>{stops.map((s, i) => <article className="stop" key={s.place}><img src={s.image} alt={`${s.place} landscape`} loading={i ? 'lazy' : 'eager'}/><div className="stop-shade"></div><span className="day">Day {s.day}</span><div><h3>{s.place}</h3><p>{s.note}</p></div></article>)}</div></section>;
}

function Why() {
  const root = useRef(null);
  useGsapScene(root, () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = gsap.utils.toArray('.promise');
    items.forEach((item, i) => gsap.from(item, { opacity: .12, x: i % 2 ? 80 : -80, scrollTrigger: { trigger: item, start: 'top 80%', end: 'top 43%', scrub: .7 } }));
  });
  return <section id="why" ref={root} className="why scene"><span className="eyebrow">The Ghure Ashi way</span><h2>We don’t just<br/>take you <i>somewhere.</i></h2><div className="promise-route" aria-hidden="true"></div>{['We find the unhurried road.', 'We know where you should pause.', 'We stay close when plans change.', 'We leave room for wonder.'].map((t,i) => <div className="promise" key={t}><span>0{i+1}</span><h3>{t}</h3></div>)}</section>;
}

function Packages({ catalog = packages, onBook }) {
  return <section id="packages" className="packages scene"><div className="section-head"><div><span className="eyebrow">Choose your next chapter</span><h2>Journeys worth<br/><i>remembering.</i></h2></div><a href="#packages">View all journeys <ArrowRight/></a></div><div className="package-grid">{catalog.map((p,i) => <article className="package-card" key={p.name}><div className="package-image"><img src={p.image} alt="" loading="lazy"/><span>0{i+1}</span></div><div className="package-info"><small>{p.meta || `${p.durationDays} days · ${p.seatsLeft} seats left`}</small><h3>{p.name}</h3><div><b>From {p.price || `₹${(p.pricePaise/100).toLocaleString('en-IN')}`}</b><button onClick={() => onBook?.(p)} aria-label={`Book ${p.name}`}><ArrowRight/></button></div></div></article>)}</div></section>;
}

function BookingFlow({ trip, catalog, close }) {
  const availableTrips=catalog.filter(item=>item.departureId&&Number(item.seatsLeft)>0);
  const initialTrip=availableTrips.find(item=>item.departureId===trip.departureId)||availableTrips[0]||trip;
  const [selectedId,setSelectedId]=useState(initialTrip.departureId);const activeTrip=availableTrips.find(item=>item.departureId===selectedId)||initialTrip;
  const [step,setStep]=useState(1); const [count,setCount]=useState(()=>Math.min(2,Math.max(1,Number(initialTrip.seatsLeft)||1))); const [status,setStatus]=useState('idle'); const [result,setResult]=useState(null); const [error,setError]=useState('');
  const [contact,setContact]=useState({customerName:'',customerEmail:'',customerPhone:''}); const [travellers,setTravellers]=useState([{fullName:'',age:'',type:'adult'},{fullName:'',age:'',type:'adult'}]);
  useEffect(()=>{setTravellers(old=>Array.from({length:count},(_,i)=>old[i]||{fullName:'',age:'',type:'adult'}));},[count]);
  useEffect(()=>{const esc=e=>e.key==='Escape'&&close();addEventListener('keydown',esc);return()=>removeEventListener('keydown',esc)},[]);
  const changeTrip=e=>{const next=availableTrips.find(item=>item.departureId===e.target.value);if(!next)return;setSelectedId(next.departureId);setCount(Math.min(2,Math.max(1,Number(next.seatsLeft))));setStep(1);setStatus('idle');setResult(null);setError('')};
  const submit=async()=>{setStatus('loading');setError('');try{const response=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({departureId:activeTrip.departureId,...contact,travellers:travellers.map(t=>({...t,age:Number(t.age)}))})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Could not reserve this journey.');setResult(body);setStatus('success');}catch(e){setError(e.message);setStatus('error');}};
  if(status==='success')return <div className="booking-shell" role="dialog" aria-modal="true"><div className="booking-confirm"><div className="confirm-route"><Check/></div><span className="eyebrow">Your route is reserved</span><h2>You’re going to<br/><i>{activeTrip.name}.</i></h2><p>Booking reference <b>{result.booking.reference}</b></p><p>Amount due: ₹{(result.booking.amountPaise/100).toLocaleString('en-IN')}</p><small>{result.payment.message}</small><button className="solid-button" onClick={close}>Return to journeys</button></div></div>;
  return <div className="booking-shell" role="dialog" aria-modal="true" aria-label={`Book ${activeTrip.name}`}><button className="booking-close" onClick={close} aria-label="Close booking"><X/></button><aside><span className="eyebrow">Your journey</span><label className="booking-trip-select"><span>Change destination</span><select value={selectedId||''} onChange={changeTrip} disabled={availableTrips.length<2}>{availableTrips.map(item=><option value={item.departureId} key={item.departureId}>{item.name} · {item.seatsLeft} seats</option>)}</select><small>{availableTrips.length>1?`${availableTrips.length} journeys currently available`:'This is the only journey currently available'}</small></label><h2>{activeTrip.name}</h2><p>{activeTrip.summary}</p><dl><div><dt>Duration</dt><dd>{activeTrip.durationDays} days</dd></div><div><dt>Availability</dt><dd>{activeTrip.seatsLeft} seats</dd></div><div><dt>From</dt><dd>₹{(activeTrip.pricePaise/100).toLocaleString('en-IN')} / person</dd></div></dl></aside><div className="booking-form"><div className="step-line"><span className={step>=1?'active':''}>01 Travellers</span><span className={step>=2?'active':''}>02 Details</span><span className={step>=3?'active':''}>03 Review</span></div>{step===1&&<div className="form-scene"><span className="eyebrow">Who is travelling?</span><h3>Choose your company.</h3><div className="counter"><button onClick={()=>setCount(Math.max(1,count-1))} aria-label="Remove one traveller">−</button><strong>{count}</strong><button onClick={()=>setCount(Math.min(Math.min(12,activeTrip.seatsLeft),count+1))} aria-label="Add one traveller">+</button></div><p>{count} traveller{count>1?'s':''} · ₹{((activeTrip.pricePaise*count)/100).toLocaleString('en-IN')}</p><button className="solid-button" onClick={()=>setStep(2)}>Continue <ArrowRight/></button></div>}{step===2&&<div className="form-scene"><span className="eyebrow">Traveller details</span><h3>Tell us who’s coming.</h3><div className="fields"><input placeholder="Contact name" value={contact.customerName} onChange={e=>setContact({...contact,customerName:e.target.value})}/><input type="email" placeholder="Email" value={contact.customerEmail} onChange={e=>setContact({...contact,customerEmail:e.target.value})}/><input placeholder="Phone" value={contact.customerPhone} onChange={e=>setContact({...contact,customerPhone:e.target.value})}/>{travellers.map((t,i)=><div className="traveller-row" key={i}><span>0{i+1}</span><input placeholder="Full name" value={t.fullName} onChange={e=>setTravellers(travellers.map((x,j)=>j===i?{...x,fullName:e.target.value}:x))}/><input type="number" min="1" max="120" placeholder="Age" value={t.age} onChange={e=>setTravellers(travellers.map((x,j)=>j===i?{...x,age:e.target.value}:x))}/></div>)}</div><div className="form-actions"><button onClick={()=>setStep(1)}><ArrowLeft/> Back</button><button className="solid-button" onClick={()=>setStep(3)}>Review <ArrowRight/></button></div></div>}{step===3&&<div className="form-scene"><span className="eyebrow">Before you reserve</span><h3>Your journey at a glance.</h3><div className="summary-card"><b>{activeTrip.name}</b><span>{count} traveller{count>1?'s':''}</span><strong>₹{((activeTrip.pricePaise*count)/100).toLocaleString('en-IN')}</strong></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button onClick={()=>setStep(2)}><ArrowLeft/> Back</button><button className="solid-button" disabled={status==='loading'} onClick={submit}>{status==='loading'?<LoaderCircle className="spin"/>:'Reserve journey'} </button></div><small>Seats are reserved as pending. Live payment activates after payment-provider credentials are configured.</small></div>}</div></div>;
}

function LegacyAdminApp(){
  const [session,setSession]=useState(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [credentials,setCredentials]=useState({email:'',password:''});const [data,setData]=useState({bookings:[],motion:{intensity:'standard',intro:true,parallax:true,pageTransitions:true}});
  const load=async()=>{try{const s=await fetch('/api/admin/session',{credentials:'include'});if(!s.ok)throw new Error();setSession((await s.json()).admin);const [b,c]=await Promise.all([fetch('/api/admin/bookings',{credentials:'include'}),fetch('/api/catalog')]);setData({bookings:(await b.json()).bookings,motion:(await c.json()).motion});}catch{setSession(null)}finally{setLoading(false)}};useEffect(()=>{load()},[]);
  const login=async e=>{e.preventDefault();setError('');const r=await fetch('/api/admin/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});const body=await r.json();if(!r.ok)return setError(body.error.message);setSession(body.admin);load()};
  const saveMotion=async()=>{const r=await fetch('/api/admin/settings/motion',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.motion)});if(!r.ok)setError('Settings could not be saved.');};
  if(loading)return <div className="admin-loading"><LoaderCircle className="spin"/> Loading control room</div>;
  if(!session)return <main className="admin-login"><form onSubmit={login}><a className="brand" href="/"><span>ঘুরে আসি</span><b>GHURE ASHI</b></a><Lock/><span className="eyebrow">Master admin</span><h1>Welcome back.</h1><input type="email" placeholder="Admin email" required value={credentials.email} onChange={e=>setCredentials({...credentials,email:e.target.value})}/><input type="password" placeholder="Password" required value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})}/>{error&&<p className="form-error">{error}</p>}<button className="solid-button">Sign in</button></form></main>;
  return <main className="admin"><aside><a className="brand" href="/"><span>ঘুরে আসি</span><b>CONTROL ROOM</b></a><nav><a className="active" href="#overview"><Users/> Bookings</a><a href="#motion"><Settings/> Story experience</a></nav><small>{session.email}</small></aside><section><header><div><span className="eyebrow">Master admin</span><h1>Journey control room</h1></div><a href="/">View website <ArrowRight/></a></header><div className="admin-stats"><article><span>Total bookings</span><strong>{data.bookings.length}</strong></article><article><span>Travellers</span><strong>{data.bookings.reduce((a,b)=>a+b.travellerCount,0)}</strong></article><article><span>Pending value</span><strong>₹{(data.bookings.reduce((a,b)=>a+b.amountPaise,0)/100).toLocaleString('en-IN')}</strong></article></div><div id="motion" className="admin-panel"><h2>Global motion settings</h2><div className="setting-grid"><label>Motion intensity<select value={data.motion.intensity} onChange={e=>setData({...data,motion:{...data.motion,intensity:e.target.value}})}><option value="low">Low</option><option value="standard">Standard</option><option value="cinematic">Cinematic</option></select></label>{[['intro','Homepage intro'],['parallax','Parallax'],['pageTransitions','Page transitions']].map(([key,label])=><label className="switch" key={key}>{label}<input type="checkbox" checked={data.motion[key]} onChange={e=>setData({...data,motion:{...data.motion,[key]:e.target.checked}})}/></label>)}</div><button className="solid-button" onClick={saveMotion}>Save settings</button></div><div id="overview" className="admin-panel"><h2>Recent bookings</h2><div className="booking-table">{data.bookings.length?data.bookings.map(b=><article key={b.reference}><div><b>{b.customerName}</b><small>{b.reference} · {b.customerEmail}</small></div><span>{b.package}</span><span>{b.travellerCount} guests</span><strong>₹{(b.amountPaise/100).toLocaleString('en-IN')}</strong><em>{b.status}</em></article>):<p>No bookings yet. New reservations will appear here.</p>}</div></div></section></main>;
}

function Memories() {
  return <section id="memories" className="memories scene"><div className="memory-photo"><img src="https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=85" alt="Travellers watching the Taj Mahal at sunrise" loading="lazy"/><span>Agra · Winter 2025</span></div><div className="memory-copy"><span className="eyebrow">A traveller’s memory</span><blockquote>“It never felt like a tour. It felt like an old friend had shown us the India they love.”</blockquote><p><b>Riya & Anik</b><Check size={14}/> Verified travellers</p></div></section>;
}

function BookingCTA() {
  return <section id="book" className="book scene"><div className="book-orbit"><Compass/></div><span className="eyebrow">The journey becomes yours</span><h2>Where should we<br/><i>go next?</i></h2><p>Tell us what you imagine. We’ll turn it into a journey.</p><MagneticButton className="light">Plan my journey</MagneticButton><footer><a className="brand" href="#top"><span>ঘুরে আসি</span><b>GHURE ASHI</b></a><p>Thoughtful journeys. Warmly Bengali.</p><span>© 2026 Ghure Ashi Tour & Travels</span></footer></section>;
}

function Progress() {
  const [p, setP] = useState(0); useEffect(() => { const fn=()=>setP(scrollY/(document.documentElement.scrollHeight-innerHeight)); addEventListener('scroll',fn,{passive:true}); return()=>removeEventListener('scroll',fn); },[]);
  return <div className="progress" aria-hidden="true"><span style={{transform:`scaleY(${p})`}}></span><b>Journey</b></div>;
}

const posterDestinations = [
  { name:'Himalayas', image:'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=700&q=85' },
  { name:'Kerala', image:'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=700&q=85' },
  { name:'Goa', image:'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=700&q=85' },
  { name:'Rajasthan', image:'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=700&q=85' },
  { name:'Darjeeling', image:'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=700&q=85' }
];

function ReviewMedia({media,travellerName}){
  if(!media)return <div className="review-media-placeholder"><Camera/><span>Traveller story</span></div>;
  return media.type==='video'?<video controls preload="metadata" aria-label={`Video shared by ${travellerName}`}><source src={media.url} type={media.mimeType}/></video>:<img src={media.url} alt={`Travel memory shared by ${travellerName}`} loading="lazy"/>;
}

function ReviewForm({close,onSubmitted}){
  const [form,setForm]=useState({travellerName:'',guestEmail:'',destination:'',travelledOn:'',rating:5,quote:'',website:''});
  const [files,setFiles]=useState([]);const [status,setStatus]=useState('idle');const [message,setMessage]=useState('');
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';const esc=e=>e.key==='Escape'&&status!=='submitting'&&close();addEventListener('keydown',esc);return()=>{document.body.style.overflow=previous;removeEventListener('keydown',esc)}},[status]);
  const choose=e=>{const selected=[...e.target.files];if(selected.length>5){setMessage('Choose up to five photos or videos.');e.target.value='';return setFiles([])}if(selected.some(file=>file.size>25*1024*1024)){setMessage('Each photo or video must be 25 MB or smaller.');e.target.value='';return setFiles([])}setMessage('');setFiles(selected)};
  const submit=async e=>{e.preventDefault();setStatus('submitting');setMessage('');try{const modeResponse=await fetch('/api/review-uploads/mode');const {mode}=modeResponse.ok?await modeResponse.json():{mode:'multipart'};let response;if(mode==='blob'&&files.length){const media=[];for(const file of files){const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(-120)||'guest-media';const blob=await uploadBlob(`reviews/${crypto.randomUUID()}-${safeName}`,file,{access:'public',handleUploadUrl:'/api/review-uploads',clientPayload:JSON.stringify(form),multipart:file.size>5*1024*1024});media.push({url:blob.url,mimeType:file.type,originalName:file.name});}response=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,media})});}else{const body=new FormData();Object.entries(form).forEach(([key,value])=>body.append(key,String(value)));files.forEach(file=>body.append('media',file));response=await fetch('/api/reviews',{method:'POST',body});}const result=await response.json();if(!response.ok)throw new Error(result.error?.message||'Your review could not be sent.');setStatus('success');setMessage(result.message);onSubmitted();}catch(error){setStatus('error');setMessage(error.message||'Your review could not be sent.')}};
  return createPortal(<div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-form-title"><button className="review-modal-close" type="button" onClick={close} aria-label="Close review form"><X/></button><form className="review-form" onSubmit={submit}>{status==='success'?<div className="review-success"><div><Check/></div><span>Your memory is with us</span><h2>Thank you for sharing.</h2><p>{message} It will appear here after the team approves it.</p><button type="button" onClick={close}>Done</button></div>:<><header><span>Traveller review</span><h2 id="review-form-title">Share your journey</h2><p>Add your story, photos or short videos. Every submission is reviewed before it goes live.</p></header><div className="review-fields"><label>Your name<input autoFocus required maxLength="100" value={form.travellerName} onChange={e=>setForm({...form,travellerName:e.target.value})}/></label><label>Email <small>Not shown publicly</small><input type="email" required maxLength="254" value={form.guestEmail} onChange={e=>setForm({...form,guestEmail:e.target.value})}/></label><label>Destination<input required maxLength="100" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/></label><label>Travel date<input type="date" max={new Date().toISOString().slice(0,10)} value={form.travelledOn} onChange={e=>setForm({...form,travelledOn:e.target.value})}/></label><fieldset><legend>Your rating</legend><div className="review-rating">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} star${n>1?'s':''}`} aria-pressed={form.rating===n} onClick={()=>setForm({...form,rating:n})}><Star fill={n<=form.rating?'currentColor':'none'}/></button>)}</div></fieldset><label className="wide">Your memory<textarea required minLength="3" maxLength="1200" rows="5" placeholder="What made this journey stay with you?" value={form.quote} onChange={e=>setForm({...form,quote:e.target.value})}/></label><label className="review-honeypot" aria-hidden="true">Website<input tabIndex="-1" autoComplete="off" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label><label className="review-upload wide"><input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={choose}/><Upload/><span><b>Add photos or videos</b><small>Up to 5 files · JPG, PNG, WebP, MP4 or WebM · 25 MB each</small></span></label>{files.length>0&&<div className="review-file-list wide">{files.map(file=><span key={`${file.name}-${file.size}`}>{file.type.startsWith('video/')?<Video/>:<Camera/>}{file.name}</span>)}</div>}</div>{message&&<p className="review-form-message" role="alert">{message}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="review-submit" disabled={status==='submitting'}>{status==='submitting'?<LoaderCircle className="spin"/>:<Upload/>} Send for approval</button></footer></>}</form></div>,document.body);
}

function ReviewSection(){
  const [reviews,setReviews]=useState([]);const [open,setOpen]=useState(false);const [loading,setLoading]=useState(true);const [submitted,setSubmitted]=useState(false);
  useEffect(()=>{fetch('/api/reviews').then(r=>r.ok?r.json():Promise.reject()).then(data=>setReviews(data.reviews||[])).catch(()=>{}).finally(()=>setLoading(false))},[]);
  return <section id="memories" className="memory-strip review-section poster-scene"><div className="review-section-head poster-reveal"><div><span>Stories from the road</span><h2>Moments today…<br/><b>memories forever</b></h2><p>Real journeys, told by the people who travelled with us.</p></div><button onClick={()=>setOpen(true)}><Camera/> Share your experience</button></div>{submitted&&<div className="review-pending-note"><ShieldCheck/> Your review was received and is awaiting approval.</div>}{loading?<div className="review-loading"><LoaderCircle className="spin"/> Loading traveller stories</div>:reviews.length?<div className="review-grid">{reviews.map(review=>{const media=review.media?.[0]||(review.imageUrl?{type:'image',url:review.imageUrl}:null);return <article className="traveller-review poster-reveal" key={review.id}><div className="traveller-review-media"><ReviewMedia media={media} travellerName={review.travellerName}/>{review.media?.length>1&&<span>+{review.media.length-1} more</span>}</div><div className="traveller-review-copy"><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map(n=><Star key={n} fill={n<=review.rating?'currentColor':'none'}/>)}</div><blockquote>“{review.quote}”</blockquote><footer><div><b>{review.travellerName}</b><span>{review.destination}{review.travelledOn?` · ${new Date(review.travelledOn).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}`:''}</span></div>{review.verified&&<em><ShieldCheck/> Verified</em>}</footer></div></article>})}</div>:<div className="review-empty poster-reveal"><Camera/><h3>The first postcard could be yours.</h3><p>Share a favourite moment from your Ghure Ashi journey.</p><button onClick={()=>setOpen(true)}>Write the first review</button></div>}{open&&<ReviewForm close={()=>setOpen(false)} onSubmitted={()=>setSubmitted(true)}/>}</section>;
}

function TravelServices({profile}){
  const phone=profile.primaryPhone?.replace(/[^+\d]/g,'');const whatsapp=profile.whatsappPhone?.replace(/\D/g,'');
  const trainHref=phone?`tel:${phone}`:profile.email?`mailto:${profile.email}?subject=Train, flight and hotel booking`:'#book';
  const customHref=whatsapp?`https://wa.me/${whatsapp}?text=${encodeURIComponent('Hello, I would like a customized tour plan.')}`:trainHref;
  return <section id="travel-services" className="poster-services poster-scene"><header className="poster-reveal"><span>More ways to travel with us</span><h2>From tickets and stays<br/>to <b>tailor-made trails.</b></h2><p>One trusted team for every booking you need and the journey you imagine.</p></header><div className="poster-service-grid"><article className="poster-service-card train-service poster-reveal"><img src="/images/ghure-ashi-hero.png" alt="Heritage train travelling through Himalayan mountains" loading="lazy"/><div className="service-card-shade"></div><div className="service-card-copy"><span>01 · Complete travel booking</span><div className="service-icon service-icon-stack"><Train/><Plane/><Hotel/></div><h3>Train, flight<br/>& hotel</h3><p>Share your route, dates and preferences. We coordinate the essential bookings so your journey fits together smoothly.</p><ul><li><Check/> Train ticket assistance</li><li><Check/> Domestic and international flights</li><li><Check/> Hotels for every budget</li></ul><a href={trainHref}><Phone/> Call for travel bookings</a></div></article><article className="poster-service-card custom-service poster-reveal"><img src="https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1600&q=85" alt="A customized road journey through mountain scenery" loading="lazy"/><div className="service-card-shade"></div><div className="service-card-copy"><span>02 · Made around you</span><div className="service-icon"><Compass/></div><h3>Customized<br/>tours</h3><p>Your dates, budget, people and pace—shaped into a personal itinerary instead of a fixed package.</p><ul><li><Check/> Flexible dates and duration</li><li><Check/> Hotels, transport and sightseeing</li><li><Check/> Couples, families and groups</li></ul><a href={customHref} target={whatsapp?'_blank':undefined} rel={whatsapp?'noreferrer':undefined}><Compass/> Plan a custom tour</a></div></article></div></section>;
}

function PosterHome({ catalog, onBook, openSearch, profile }){
  const root=useRef(null);
  useGsapScene(root,()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    gsap.utils.toArray('.poster-scene').forEach(scene=>gsap.from(scene.querySelectorAll('.poster-reveal'),{y:55,opacity:0,stagger:.1,duration:.9,ease:'power3.out',scrollTrigger:{trigger:scene,start:'top 72%'}}));
    gsap.to('.poster-plane',{x:'35vw',y:'-10vh',rotate:8,ease:'none',scrollTrigger:{trigger:'.poster-hero',start:'top top',end:'bottom top',scrub:1}});
  });
  const phoneHref=value=>`tel:${value.replace(/[^+\d]/g,'')}`;const whatsappHref=value=>`https://wa.me/${value.replace(/\D/g,'')}`;const firstAvailable=catalog.find(item=>item.departureId&&Number(item.seatsLeft)>0);
  return <div ref={root} className="poster-home"><Header openSearch={openSearch} profile={profile}/><main id="main">
    <section id="top" className="poster-hero poster-scene">
      <img className="poster-hero-bg" src="/images/ghure-ashi-hero.png" alt="Blue heritage train winding through Himalayan mountains above the clouds"/>
      <div className="poster-vignette"></div><div className="poster-plane" aria-hidden="true"><Plane fill="currentColor"/></div>
      <svg className="flight-doodle" viewBox="0 0 500 160" aria-hidden="true"><path d="M5 140 C120 10 245 160 490 15"/></svg>
      <div className="poster-logo poster-reveal"><img className="official-logo" src={profile.logoUrl} alt={profile.businessName}/><em>{profile.tagline}</em><strong>Explore. Experience. Remember.</strong></div>
    </section>

    <section id="india" className="poster-feature poster-scene india-feature"><div className="feature-copy poster-reveal"><span>Incredible</span><h2>India</h2><p><MapPin/> Mountains, valleys,<br/>rivers & more…</p></div><div className="feature-tag poster-reveal"><span>Every track</span><b>holds a story</b></div></section>

    <section className="poster-feature poster-scene road-feature"><div className="road-copy poster-reveal"><span>Every road</span><h2>Leads to<br/><b>adventure</b></h2><p><MapPin/> Unlimited destinations<br/>Endless memories</p></div></section>

    <section id="discover" className="postcard-scene poster-scene"><div className="poster-heading poster-reveal"><h2>Discover India</h2><p>Diverse. Beautiful. Unforgettable.</p></div><div className="postcard-row">{posterDestinations.map((d,i)=><article className="postcard poster-reveal" style={{'--tilt':`${i%2?2:-2}deg`}} key={d.name}><img src={d.image} alt={`${d.name} travel destination`} loading="lazy"/><h3>{d.name}</h3></article>)}</div></section>

    <section className="poster-feature poster-scene world-feature"><div className="world-copy poster-reveal"><Plane/><h2>The world<br/><b>is calling</b></h2><p><MapPin/> International holidays<br/>Tailor-made for you</p></div><svg className="world-route" viewBox="0 0 400 120" aria-hidden="true"><path d="M10 100 C110 0 210 150 390 20"/></svg></section>

    <Why/>

    <ReviewSection/>

    <section id="packages" className="poster-packages poster-scene"><div className="poster-heading poster-reveal"><span>Handpicked for you</span><h2>Journeys ready<br/>to become yours</h2></div><div className="poster-package-grid">{catalog.map((p,i)=>{const bookable=p.departureId&&Number(p.seatsLeft)>0;return <article className="poster-package poster-reveal" key={p.name}><img src={p.image} alt="" loading="lazy"/><div><span>0{i+1} · {p.durationDays||7} days</span><h3>{p.name}</h3><p>{p.summary||'A thoughtful journey through extraordinary landscapes.'}</p><b>{p.pricePaise?`₹${(p.pricePaise/100).toLocaleString('en-IN')}`:p.price}</b><button disabled={!bookable} onClick={()=>bookable&&onBook(p)}>{bookable?'Explore':'Unavailable'} <ArrowRight/></button></div></article>})}</div></section>

    <TravelServices profile={profile}/>

    <section id="book" className="poster-book poster-scene"><div className="paper-plane" aria-hidden="true"><Plane/></div><div className="next-journey poster-reveal"><span>Your next</span><h2>Journey</h2><b>starts here</b></div><div className="book-brand poster-reveal"><img src={profile.logoUrl} alt=""/><h2>{profile.businessName}</h2><em>{profile.tagline}</em></div><div className="contact-row poster-reveal"><span><MapPin/> {profile.address}</span>{profile.primaryPhone&&<a href={phoneHref(profile.primaryPhone)}><Phone/> {profile.primaryPhone}</a>}{profile.secondaryPhone&&<a href={phoneHref(profile.secondaryPhone)}><Phone/> {profile.secondaryPhone}</a>}{profile.email&&<a href={`mailto:${profile.email}`}>{profile.email}</a>}{profile.whatsappPhone&&<a href={whatsappHref(profile.whatsappPhone)} target="_blank" rel="noreferrer">WhatsApp</a>}{profile.officeHours&&<small>{profile.officeHours}</small>}</div><div className="service-row"><span><Palmtree/> Tour packages</span><span><Compass/> Customized tours</span><span><Train/> Train · flight · hotel</span><span><Headphones/> 24/7 support</span></div><button className="poster-book-button" disabled={!firstAvailable} onClick={()=>firstAvailable&&onBook(firstAvailable)}>{firstAvailable?'Book now':'No departures available'}</button></section>
  </main></div>;
}

function App() {
  const [search, setSearch] = useState(false); const [booking,setBooking]=useState(null); const [catalog,setCatalog]=useState(packages);const [profile,setProfile]=useState({businessName:'Ghure Ashi Tour & Travels',tagline:'Your journey. Our responsibility.',primaryPhone:'7980240895',secondaryPhone:'9062964425',whatsappPhone:'7980240895',email:'',address:'Domjur, Howrah',officeHours:'Every day, 9 AM–8 PM',logoUrl:'/images/ghure-ashi-logo.png'});
  useEffect(()=>{fetch('/api/catalog').then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(d.packages?.length)setCatalog(d.packages);if(d.businessProfile)setProfile(d.businessProfile)}).catch(()=>{})},[]);
  return <><PosterHome catalog={catalog} profile={profile} onBook={setBooking} openSearch={()=>setSearch(true)}/><SearchOverlay open={search} close={() => setSearch(false)}/>{booking&&<BookingFlow trip={booking} catalog={catalog} close={()=>setBooking(null)}/>}</>;
}

createRoot(document.getElementById('root')).render(location.pathname.startsWith('/admin')?<Suspense fallback={<div className="admin-loading"><LoaderCircle className="spin"/> Loading control room</div>}><AdminControlRoom/></Suspense>:<App/>);
