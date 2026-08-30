require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
app.use(express.json({limit:'12mb'}));
app.use(express.urlencoded({extended:true, limit:'12mb'}));

const PLATFORMS=['Instagram','Facebook','Twitter / X','LinkedIn'];
const TYPES=['Awareness','Educational','Event','Fundraising','Community Update'];
const STATUSES=['Planned','Published','Draft','Scheduled'];

const userSchema = new mongoose.Schema({
  username:{type:String,required:true,unique:true,trim:true},
  name:{type:String,required:true,trim:true},
  email:{type:String,required:true,trim:true,lowercase:true},
  passwordHash:{type:String,required:true}, role:{type:String,enum:['admin','user'],default:'user'},
  registeredAt:{type:Date,default:Date.now}, lastLogin:{type:Date,default:null},
  org:{type:String,default:''}, phone:{type:String,default:''}, about:{type:String,default:''}, logo:{type:String,default:null}
},{timestamps:true});
const postSchema = new mongoose.Schema({
  title:{type:String,required:true,trim:true}, platform:{type:String,enum:PLATFORMS,required:true},
  type:{type:String,enum:TYPES,required:true}, status:{type:String,enum:STATUSES,required:true},
  date:{type:String,required:true}, time:{type:String,default:''}, content:{type:String,default:''}, image:{type:String,default:null},
  likes:{type:Number,default:0}, comments:{type:Number,default:0}, shares:{type:Number,default:0}, reach:{type:Number,default:0},
  owner:{type:String,required:true,index:true}
},{timestamps:true});
const User=mongoose.model('User',userSchema); const Post=mongoose.model('Post',postSchema);

function auth(req,res,next){
  const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):null;
  if(!token) return res.status(401).json({message:'Authentication required.'});
  try{ req.user=jwt.verify(token,JWT_SECRET); next(); }catch(e){ return res.status(401).json({message:'Invalid or expired session.'}); }
}
function adminOnly(req,res,next){ if(req.user.role!=='admin') return res.status(403).json({message:'Admin access required.'}); next(); }
function signUser(u){return jwt.sign({id:String(u._id),username:u.username,role:u.role,name:u.name,email:u.email},JWT_SECRET,{expiresIn:'7d'});}
function publicUser(u){return {username:u.username,name:u.name,email:u.email,role:u.role,registeredAt:u.registeredAt,lastLogin:u.lastLogin};}
function engagement(){const likes=Math.floor(Math.random()*450)+50;return {likes,comments:Math.floor(likes*(.05+Math.random()*.12)),shares:Math.floor(likes*(.03+Math.random()*.09)),reach:Math.floor(likes*(4+Math.random()*7))};}

app.get('/api/health',(req,res)=>res.json({ok:true}));
app.post('/api/auth/register',async(req,res)=>{try{
  const {name,username,email,password,org=''}=req.body;
  if(!name||!username||!email||!password) return res.status(400).json({message:'Please fill in all fields.'});
  if(password.length<6) return res.status(400).json({message:'Password must be at least 6 characters.'});
  if(await User.findOne({username})) return res.status(409).json({message:'Username already exists.'});
  const passwordHash=await bcrypt.hash(password,12); const u=await User.create({name,username,email,passwordHash,role:'user',org,lastLogin:new Date()});
  res.status(201).json({token:signUser(u),user:publicUser(u)});
}catch(e){console.error(e);res.status(500).json({message:'Registration failed.'});}});

app.post('/api/auth/login',async(req,res)=>{try{
  const {username,password}=req.body; const u=await User.findOne({username});
  if(!u || !(await bcrypt.compare(password,u.passwordHash))) return res.status(401).json({message:'Invalid username or password.'});
  u.lastLogin=new Date(); await u.save(); res.json({token:signUser(u),user:publicUser(u)});
}catch(e){console.error(e);res.status(500).json({message:'Login failed.'});}});
app.post('/api/auth/forgot',async(req,res)=>{res.json({message:'If the email exists in our system, reset instructions would be sent.'});});

app.get('/api/posts',auth,async(req,res)=>{try{const q=req.user.role==='admin'?{}:{owner:req.user.username}; const posts=await Post.find(q).sort({date:1,time:1,createdAt:1}).lean();res.json(posts);}catch(e){res.status(500).json({message:'Could not load posts.'});}});
app.post('/api/posts',auth,async(req,res)=>{try{
  const {title,platform,type,status,date,time='',content='',image=null}=req.body;
  if(!title||!date) return res.status(400).json({message:'Please enter a post title and date.'});
  if(!PLATFORMS.includes(platform)||!TYPES.includes(type)||!STATUSES.includes(status)) return res.status(400).json({message:'Invalid post options.'});
  if(date < new Date().toISOString().slice(0,10)) return res.status(400).json({message:'Previous dates are not allowed for a new post.'});
  const p=await Post.create({title,platform,type,status,date,time,content,image,owner:req.user.username,...(status==='Published'?engagement():{})}); res.status(201).json(p);
}catch(e){console.error(e);res.status(500).json({message:'Could not create post.'});}});
app.put('/api/posts/:id',auth,async(req,res)=>{try{
  const p=await Post.findById(req.params.id); if(!p) return res.status(404).json({message:'Post not found.'});
  if(req.user.role!=='admin'&&p.owner!==req.user.username) return res.status(403).json({message:'You can only edit your own posts.'});
  const allowed=['title','platform','type','status','date','time','content','image']; allowed.forEach(k=>{if(req.body[k]!==undefined)p[k]=req.body[k];});
  if(p.status==='Published' && !p.likes&&!p.comments&&!p.shares&&!p.reach) Object.assign(p,engagement()); await p.save(); res.json(p);
}catch(e){console.error(e);res.status(500).json({message:'Could not update post.'});}});
app.delete('/api/posts/:id',auth,async(req,res)=>{try{
  const p=await Post.findById(req.params.id); if(!p) return res.status(404).json({message:'Post not found.'});
  if(req.user.role!=='admin'&&p.owner!==req.user.username) return res.status(403).json({message:'You can only delete your own posts.'});
  await p.deleteOne();res.json({ok:true});
}catch(e){res.status(500).json({message:'Could not delete post.'});}});

app.get('/api/profile',auth,async(req,res)=>{const u=await User.findOne({username:req.user.username});res.json({name:u.name,email:u.email,org:u.org,phone:u.phone,about:u.about,logo:u.logo});});
app.put('/api/profile',auth,async(req,res)=>{try{const u=await User.findOne({username:req.user.username});Object.assign(u,{name:req.body.name,email:req.body.email,org:req.body.org,phone:req.body.phone,about:req.body.about,logo:req.body.logo||null});await u.save();res.json({ok:true,profile:{name:u.name,email:u.email,org:u.org,phone:u.phone,about:u.about,logo:u.logo}});}catch(e){res.status(500).json({message:'Could not save profile.'});}});

app.get('/api/users',auth,adminOnly,async(req,res)=>res.json(await User.find({}).sort({registeredAt:1}).lean().then(xs=>xs.map(publicUser))));
app.delete('/api/users/:username',auth,adminOnly,async(req,res)=>{try{if(req.params.username===req.user.username)return res.status(400).json({message:"You can't delete the account you're logged in as."});const u=await User.findOneAndDelete({username:req.params.username});if(!u)return res.status(404).json({message:'User not found.'});await Post.deleteMany({owner:req.params.username});res.json({ok:true});}catch(e){res.status(500).json({message:'Could not delete account.'});}});

app.use(express.static(path.join(__dirname,'public')));
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

async function start(){
  if(!process.env.MONGODB_URI){console.error('Missing MONGODB_URI in .env');process.exit(1);}
  await mongoose.connect(process.env.MONGODB_URI); console.log('MongoDB connected.');
  const adminUser=process.env.ADMIN_USERNAME||'admin'; const adminPass=process.env.ADMIN_PASSWORD||'admin123';
  if(!(await User.findOne({username:adminUser}))){const passwordHash=await bcrypt.hash(adminPass,12);await User.create({username:adminUser,name:'Administrator',email:'',passwordHash,role:'admin',email:process.env.ADMIN_EMAIL||'admin@local.test'});console.log(`Seeded admin: ${adminUser}`);}
  app.listen(PORT,'0.0.0.0',()=>console.log(`Server running at http://127.0.0.1:${PORT}`));
}
start().catch(e=>{console.error('Startup error:',e);process.exit(1);});
