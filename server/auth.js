import jwt from 'jsonwebtoken';
import { query } from './db.js';

const COOKIE = 'ga_admin';
const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  return value;
};

export function createSession(res, admin) {
  const token = jwt.sign({ sub: admin.id }, secret(), { expiresIn: '8h', issuer: 'ghure-ashi' });
  res.cookie(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/' });
}
export function clearSession(res) { res.clearCookie(COOKIE, { httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'strict', path:'/' }); }
export async function requireAdmin(req,res,next) {
  try {
    const token=jwt.verify(req.cookies[COOKIE], secret(), { issuer:'ghure-ashi' });
    const result=await query('SELECT id,email,display_name AS "displayName",role,permissions,active FROM admins WHERE id=$1',[token.sub]);
    const admin=result.rows[0];
    if(!admin?.active) throw new Error('inactive');
    req.admin=admin;
    next();
  } catch { res.status(401).json({ error:{ code:'UNAUTHORIZED', message:'Sign in is required.' } }); }
}

export function requireMaster(req,res,next){if(req.admin?.role==='master')return next();res.status(403).json({error:{code:'FORBIDDEN',message:'Master account access is required.'}});}
export function requirePermission(permission){return (req,res,next)=>{if(req.admin?.role==='master'||req.admin?.permissions?.includes(permission))return next();res.status(403).json({error:{code:'FORBIDDEN',message:'You do not have access to this control.'}});};}
