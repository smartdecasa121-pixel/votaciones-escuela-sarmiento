/* Votaciones Escuela Sarmiento — cliente Supabase. No colocar service_role key en el navegador. */
const CONFIG={url:'https://fcibtyumzxuthnjecwpv.supabase.co',anonKey:'sb_publishable_inO7chZ4QFHLbKm5JsMpoQ_vZ4p8NGu'};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let db=null,user=null,profile=null,currentView='inicio',currentRoom=null,currentGroupTab='chat',rooms=[];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3000)}
function dateLabel(s){if(!s)return 'Sin fecha definida';return new Date(s).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}
function configured(){return Boolean(CONFIG.url&&CONFIG.anonKey&&window.supabase)}
function modal(title,body){$('#modalRoot').innerHTML=`<div class="modal-backdrop" id="backdrop"><section class="modal"><div class="modal-head"><div><h2>${title}</h2></div><button class="close-btn" id="closeModal" aria-label="Cerrar">×</button></div>${body}</section></div>`;$('#closeModal').onclick=closeModal;$('#backdrop').addEventListener('click',e=>{if(e.target.id==='backdrop')closeModal()})}
function closeModal(){$('#modalRoot').innerHTML=''}
function needAuth(){if(!user){authModal('login');return false}return true}
function authModal(mode='login'){
 const signup=mode==='signup';
 modal(signup?'Crear cuenta':'Ingresar',`<p class="muted">${signup?'Elegí un nombre de usuario y una contraseña. No necesitás correo electrónico.':'Ingresá con tu nombre de usuario y contraseña.'}</p><form id="authForm"><div class="field"><label>Nombre de usuario</label><input name="username" type="text" minlength="3" maxlength="20" pattern="[A-Za-z0-9_.-]+" autocomplete="username" required placeholder="Ej.: agus2016"></div>${signup?'<div class="field"><label>Nombre para mostrar</label><input name="name" maxlength="60" required></div>':''}<div class="field"><label>Contraseña</label><input name="password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required></div><button class="btn btn-dark" style="width:100%" type="submit">${signup?'Crear cuenta':'Ingresar'}</button></form><p class="muted">${signup?'¿Ya tenés cuenta?':'¿Todavía no tenés cuenta?'} <button class="text-btn" id="switchAuth">${signup?'Ingresar':'Crear cuenta'}</button></p>`);
 $('#switchAuth').onclick=()=>authModal(signup?'login':'signup');
 $('#authForm').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const username=String(f.get('username')).trim().toLowerCase();
  const password=String(f.get('password'));
  if(!/^[a-z0-9_.-]{3,20}$/.test(username)){toast('El usuario debe tener entre 3 y 20 caracteres: letras, números, punto, guion o guion bajo.');return}
  // Se crea una cuenta confirmada desde una Edge Function segura: no se envían correos.
  const internalEmail=username+'@votaciones-escuela-sarmiento.com';
  let r;
  if(signup){
   const response=await fetch(CONFIG.url+'/functions/v1/send-push',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':CONFIG.anonKey},
    body:JSON.stringify({action:'signup',username,displayName:String(f.get('name')).trim(),password})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok){toast(result.error||'No se pudo crear la cuenta.');return}
   r=await db.auth.signInWithPassword({email:internalEmail,password});
  }else{
   r=await db.auth.signInWithPassword({email:internalEmail,password});
  }
  if(r.error){toast(r.error.message);return}
  closeModal();
  toast(signup?'¡Cuenta creada!':'¡Bienvenido/a!');
  await refreshUser();
  go('inicio')
 };
}
async function refreshUser(){const {data:{user:u}}=await db.auth.getUser();user=u;profile=null;if(user){const r=await db.from('profiles').select('user_id,display_name,role,created_at,suspended,language').eq('user_id',user.id).maybeSingle();if(r.error)console.warn(r.error);profile=r.data||{user_id:user.id,display_name:user.user_metadata?.display_name||user.email,role:'student'};if(profile.suspended){await db.auth.signOut();user=null;profile=null;toast('Esta cuenta está suspendida. Contactá a la administración.')}}renderAuthUI()}
function renderAuthUI(){$('#userBadge').textContent=user?(profile?.display_name||user.email):'Invitado';$('#authBtn').textContent=user?'Salir':'Ingresar';$$('.admin-only').forEach(x=>x.classList.toggle('hidden',profile?.role!=='admin'))}
let renderSequence=0;
function go(view){
 const allowed=['inicio','grupos','admin'];
 if(!allowed.includes(view))view='inicio';
 currentView=view;
 $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 try{if(location.hash!=='#'+view)history.pushState(null,'','#'+view)}catch(e){}
 renderView();
}
function handleHashRoute(){const view=location.hash.replace(/^#/,'');if(['inicio','grupos','admin'].includes(view))go(view)}
window.addEventListener('hashchange',handleHashRoute);window.addEventListener('popstate',handleHashRoute);
function titleBlock(title,desc,action=''){return `<div class="page-title"><div><p class="eyebrow">ESCUELA SARMIENTO</p><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function projectCard(c){return `<article class="project-card"><div class="emoji">💡</div><span class="pill">${c.status==='approved'?'Candidato/a':c.status==='pending'?'En revisión':'Proyecto'}</span><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p><div class="meta">Propuesto por ${escapeHTML(c.display_name||'Estudiante')} · ${dateLabel(c.created_at)}</div>${c.status==='approved'?`<button class="btn btn-light btn-small" data-vote="${c.id}">Votar por este proyecto →</button>`:''}</article>`}
async function getCandidates(approvedOnly=true){if(!db)return[];let q=db.from('candidates').select('id,user_id,title,description,status,created_at,start_date,end_date,profiles(display_name)').order('created_at',{ascending:false});if(approvedOnly)q=q.eq('status','approved');const {data,error}=await q;if(error){console.error(error);return[]}return(data||[]).map(c=>({...c,display_name:c.profiles?.display_name||'Estudiante'}))}
async function renderView(){const sequence=++renderSequence;const main=$('#main');if(!configured()){main.innerHTML=`${titleBlock('Conectemos la escuela','Antes de usar la plataforma, configurá Supabase.')}<div class="panel-card"><h3>Falta la configuración de Supabase</h3><p>En el archivo <code>app.js</code>, completá <code>CONFIG.url</code> y <code>CONFIG.anonKey</code> con la URL del proyecto y la clave publicable (anon) de Supabase. Nunca uses la clave <code>service_role</code> en el navegador.</p><p>Después subí los archivos a GitHub y desplegá en Vercel siguiendo <code>README.md</code>.</p></div>`;return}
 if(currentView==='inicio'){
 main.innerHTML='<section class="hero"><div><p class="eyebrow">PARTICIPÁ · PROPONÉ · VOTÁ</p><h1>Tu escuela,<br><span>tu voz.</span></h1><p class="hero-copy">Un espacio para compartir ideas, conocer proyectos y participar en los grupos de la Escuela Sarmiento.</p><div class="hero-actions"><button class="btn btn-dark" data-go="grupos">Entrar a mis grupos →</button></div></div><div class="hero-art"><div class="sun"></div><div class="art-card card-one">💡<b>Ideas</b><small>que mejoran la escuela</small></div><div class="art-card card-two">✋<b>Tu voto</b><small>hace la diferencia</small></div><div class="art-star">✦</div></div></section><section class="notice"><span>💛</span><div><b>Un acuerdo para convivir mejor</b><p>Respetamos las ideas de los demás, cuidamos nuestros mensajes y participamos con responsabilidad.</p></div></section><footer>Votaciones Escuela Sarmiento · Proyecto escolar</footer>';
 return
}
if(currentView==='candidatos'){const cs=await getCandidates(false);if(sequence!==renderSequence)return;main.innerHTML=`${titleBlock('Candidatos y proyectos','Conocé las propuestas de tus compañeros.',user?'<button class="btn btn-dark" id="newCandidate">＋ Proponer proyecto</button>':'<button class="btn btn-dark" id="loginPrompt">Ingresar para proponer</button>')}<div class="cards-grid">${cs.length?cs.map(projectCard).join(''):'<div class="empty">Todavía no hay propuestas. ¡Podés ser el primero en compartir una idea!</div>'}</div>`;$('#newCandidate')?.addEventListener('click',candidateModal);$('#loginPrompt')?.addEventListener('click',()=>authModal('login'));return}
 if(currentView==='votaciones'){if(!user){main.innerHTML=`${titleBlock('Votaciones','Para emitir tu voto, primero tenés que ingresar.')}<div class="panel-card"><h3>Tu voz cuenta</h3><p>Ingresá con tu cuenta para ver los proyectos aprobados y emitir un único voto.</p><button class="btn btn-dark" id="voteLogin">Ingresar</button></div>`;$('#voteLogin').onclick=()=>authModal('login');return}const cs=await getCandidates();const {data:existing,error:voteReadError}=await db.from('votes').select('id,candidate_id,created_at').eq('user_id',user.id).maybeSingle();const results=await db.rpc('public_vote_results');if(sequence!==renderSequence)return;if(voteReadError||results.error){main.innerHTML=titleBlock('Votaciones','No se pudieron cargar los datos.')+'<div class="panel-card">'+escapeHTML(voteReadError?.message||results.error?.message||'Error desconocido')+'</div>';return}const counts=results.data||[];main.innerHTML=`${titleBlock('Votaciones','Cada estudiante puede emitir un solo voto. Pensá qué propuesta representa mejor al grupo.')}${existing?`<div class="notice"><span>✓</span><div><b>Tu voto ya fue registrado</b><p>La plataforma no permite volver a votar. Gracias por participar.</p></div></div>`:''}<div class="cards-grid">${cs.length?cs.map(c=>{const count=counts.find(x=>x.candidate_id===c.id)?.vote_count||0;return `<article class="project-card"><div class="emoji">✋</div><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p>${results.data?`<div class="meta">Votos: ${count}</div>`:''}<button class="btn ${existing?'btn-light':'btn-dark'} btn-small" data-vote="${c.id}" ${existing?'disabled':''}>${existing?'Voto emitido':'Votar por este proyecto'}</button></article>`}).join(''):'<div class="empty">No hay proyectos aprobados para votar todavía.</div>'}</div>`;return}
 
 if(currentView==='grupos'){if(!user){main.innerHTML=`${titleBlock('Grupos','Creá espacios para organizar ideas y conversar.')}<div class="panel-card"><p>Ingresá para crear un grupo o unirte a uno con contraseña.</p><button class="btn btn-dark" id="groupsLogin">Ingresar</button></div>`;$('#groupsLogin').onclick=()=>authModal('login');return}await renderGroups(sequence);return}
 if(currentView==='admin'){if(profile?.role!=='admin'){main.innerHTML=`${titleBlock('Administración','Esta sección es solo para la cuenta administradora.')}<div class="panel-card">No tenés permisos para entrar acá.</div>`;return}await renderAdmin(sequence);return}
}

function candidateModal(groupId=currentRoom){
 if(!needAuth())return;
 if(!groupId){toast('Primero entrá a un grupo.');return}
 const room=rooms.find(r=>r.id===groupId);if(!room)return;
 if(room.member_permissions?.candidates===false&&room.created_by!==user.id){toast('El dueño desactivó las propuestas para integrantes.');return}
 modal('Proponer un candidato','<p class="muted">La propuesta queda pendiente de aprobación de la administración. Se publicará dentro de '+escapeHTML(room.name)+'.</p><form id="candidateForm"><div class="field"><label>Nombre del proyecto</label><input name="title" maxlength="100" required></div><div class="field"><label>¿En qué consiste?</label><textarea name="description" maxlength="1200" required></textarea></div><div class="two-col"><div class="field"><label>Fecha de inicio</label><input name="start_date" type="date"></div><div class="field"><label>Fecha de cierre</label><input name="end_date" type="date"></div></div><button class="btn btn-dark">Enviar propuesta</button></form>');
 $('#candidateForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),start=f.get('start_date')||null,end=f.get('end_date')||null;if(start&&end&&end<start){toast('La fecha de cierre no puede ser anterior al inicio.');return}const {error}=await db.from('candidates').insert({group_id:groupId,user_id:user.id,title:String(f.get('title')).trim(),description:String(f.get('description')).trim(),start_date:start,end_date:end,status:'pending'});if(error){toast(error.message);return}closeModal();toast('Propuesta enviada para revisión.');currentGroupTab='candidatos';await renderGroupWorkspace()};
}

async function vote(id){if(!needAuth())return;const {data,error}=await db.rpc('cast_vote',{candidate_uuid:id});if(error){toast(error.message.includes('already')||error.message.includes('duplicate')?'Ya emitiste tu voto.':error.message);return}toast('¡Voto registrado!');go('votaciones')}
async function sha256(s){const bytes=new TextEncoder().encode(s);const hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}

async function renderGroups(sequence){
 const {data:members,error}=await db.from('group_members').select('group_id,chat_groups(id,name,description,created_at,created_by,visibility,logo_url,member_permissions)').eq('user_id',user.id);
 if(sequence&&sequence!==renderSequence)return;
 if(error){$('#main').innerHTML=titleBlock('Grupos','No se pudieron cargar los grupos.')+'<div class="panel-card">'+escapeHTML(error.message)+'</div>';return}
 rooms=(members||[]).map(x=>x.chat_groups).filter(Boolean);
 if(currentRoom&&!rooms.some(r=>r.id===currentRoom))currentRoom=null;
 if(currentRoom){await renderGroupWorkspace();return}
 const directory=await db.rpc('public_group_directory');
 const publicGroups=(directory.data||[]).filter(g=>!rooms.some(r=>r.id===g.id));
 let cards=rooms.map(r=>'<button class="group-card" data-room="'+r.id+'"><div class="group-logo">'+(r.logo_url?'<img src="'+escapeHTML(r.logo_url)+'" alt="">':'💡')+'</div><div class="group-card-info"><b>'+escapeHTML(r.name)+'</b><small>'+escapeHTML(r.description||'Grupo escolar')+'</small><span class="muted">'+(r.visibility==='public'?'Público':'Privado')+' · Abrir grupo →</span></div></button>').join('');
 let discovered=publicGroups.map(g=>'<article class="group-card"><div class="group-logo">'+(g.logo_url?'<img src="'+escapeHTML(g.logo_url)+'" alt="">':'🌟')+'</div><div class="group-card-info"><b>'+escapeHTML(g.name)+'</b><small>'+escapeHTML(g.description||'Grupo público')+'</small><span class="muted">'+g.member_count+' integrantes</span><button class="btn btn-dark btn-small" data-join-public="'+g.id+'" data-public-name="'+escapeHTML(g.name)+'">Unirme</button></div></article>').join('');
 $('#main').innerHTML=titleBlock('Mis grupos','Acá están los grupos a los que te uniste. Cada grupo tiene su propio chat, votaciones y candidatos.','<button class="btn btn-dark" id="createGroup">＋ Crear grupo</button>')+
 '<div class="cards-grid group-cards">'+(cards||'<div class="empty">Todavía no te uniste a ningún grupo.</div>')+'</div>'+
 '<section class="section-head"><div><p class="eyebrow">DESCUBRIR</p><h2>Grupos públicos</h2></div><button class="btn btn-light btn-small" id="joinPrivate">Unirme a un grupo privado</button></section>'+
 '<div class="cards-grid group-cards">'+(discovered||'<div class="empty">No hay otros grupos públicos por ahora.</div>')+'</div>';
 $('#createGroup').onclick=createGroupModal;$('#joinPrivate').onclick=joinGroupModal;
 $$('[data-room]').forEach(b=>b.onclick=()=>{currentRoom=b.dataset.room;currentGroupTab='chat';renderGroups()});
 $$('[data-join-public]').forEach(b=>b.onclick=async()=>{const {error}=await db.rpc('join_chat_group',{group_name:b.dataset.publicName,group_password_hash:null});if(error){toast(error.message);return}currentRoom=b.dataset.joinPublic;currentGroupTab='chat';toast('¡Te uniste al grupo!');await renderGroups()});
}
async function renderGroupWorkspace(){
 const room=rooms.find(r=>r.id===currentRoom);if(!room){currentRoom=null;await renderGroups();return}
 const memberCount=await db.rpc('group_member_count',{p_group_id:room.id});const count=memberCount.data??0;
 const head='<div class="group-workspace-head"><button class="btn btn-light btn-small" id="backToGroups">← Mis grupos</button><div class="group-identity"><div class="group-logo large">'+(room.logo_url?'<img src="'+escapeHTML(room.logo_url)+'" alt="">':'💡')+'</div><div><h1>'+escapeHTML(room.name)+'</h1><p>'+escapeHTML(room.description||'')+'</p><small>'+(count??0)+' integrantes · '+(room.visibility==='public'?'Público':'Privado')+'</small></div></div>'+(room.created_by===user.id?'<button class="btn btn-light btn-small" id="ownerGroupSettings">⚙ Configurar grupo</button>':'<button class="btn btn-light btn-small danger" id="leaveGroup">Salir del grupo</button>')+'</div>';
 const tabs=['chat','votaciones','candidatos'].map(t=>'<button data-group-tab="'+t+'" class="'+(currentGroupTab===t?'active':'')+'">'+(t==='chat'?'Chat':t==='votaciones'?'Votaciones':'Candidatos')+'</button>').join('');
 $('#main').innerHTML=titleBlock('Grupos','')+'<div class="group-workspace">'+head+'<nav class="group-tabs">'+tabs+'</nav><section id="groupTabContent" class="panel-card group-tab-content"><div class="loading">Cargando…</div></section></div>';
 $('#backToGroups').onclick=()=>{currentRoom=null;renderGroups()};
 $('#ownerGroupSettings')?.addEventListener('click',ownerGroupSettings);
 $('#leaveGroup')?.addEventListener('click',async()=>{if(!confirm('¿Salir de este grupo?'))return;const {error}=await db.from('group_members').delete().eq('group_id',currentRoom).eq('user_id',user.id);if(error){toast(error.message);return}currentRoom=null;toast('Saliste del grupo.');await renderGroups()});
 $$('[data-group-tab]').forEach(b=>b.onclick=()=>{currentGroupTab=b.dataset.groupTab;renderGroupWorkspace()});
 const content=$('#groupTabContent');
 if(currentGroupTab==='chat'){content.id='roomContent';await renderRoomMessages();return}
 if(currentGroupTab==='candidatos'){await renderGroupCandidates();return}
 await renderGroupVotes();
}
async function renderGroupCandidates(){
 const host=$('#groupTabContent'),room=rooms.find(r=>r.id===currentRoom);if(!host||!room)return;
 const {data:cs,error}=await db.from('candidates').select('id,user_id,group_id,title,description,status,created_at,start_date,end_date,profiles(display_name)').eq('group_id',room.id).order('created_at',{ascending:false});
 if(error){host.innerHTML=escapeHTML(error.message);return}
 host.innerHTML='<div class="row"><div><h2>Candidatos y proyectos</h2><p class="muted">Propuestas de los integrantes de este grupo.</p></div><button class="btn btn-dark btn-small" id="newGroupCandidate">＋ Proponer</button></div><div class="cards-grid">'+(cs.length?cs.map(c=>'<article class="project-card"><span class="pill">'+(c.status==='approved'?'Aprobado':c.status==='pending'?'En revisión':'Rechazado')+'</span><h3>'+escapeHTML(c.title)+'</h3><p>'+escapeHTML(c.description)+'</p><small class="muted">Por '+escapeHTML(c.profiles?.display_name||'Estudiante')+'</small></article>').join(''):'<div class="empty">Todavía no hay propuestas en este grupo.</div>')+'</div>';
 $('#newGroupCandidate').onclick=()=>candidateModal(currentRoom);
}
async function renderGroupVotes(){
 const host=$('#groupTabContent'),room=rooms.find(r=>r.id===currentRoom);if(!host||!room)return;
 const [cs,myVote,results]=await Promise.all([
  db.from('candidates').select('id,title,description,status').eq('group_id',room.id).eq('status','approved').order('created_at',{ascending:false}),
  db.from('votes').select('id,candidate_id').eq('group_id',room.id).eq('user_id',user.id).maybeSingle(),
  db.rpc('group_vote_results',{p_group_id:room.id})
 ]);
 if(cs.error||myVote.error||results.error){host.innerHTML=escapeHTML(cs.error?.message||myVote.error?.message||results.error?.message);return}
 host.innerHTML='<h2>Votaciones del grupo</h2><p class="muted">Cada integrante puede votar una sola vez en este grupo.</p>'+(myVote.data?'<div class="notice"><span>✓</span><div><b>Ya emitiste tu voto en este grupo.</b></div></div>':'')+'<div class="cards-grid">'+(cs.data.length?cs.data.map(c=>{const n=Number((results.data||[]).find(v=>v.candidate_id===c.id)?.vote_count||0);return '<article class="project-card"><h3>'+escapeHTML(c.title)+'</h3><p>'+escapeHTML(c.description)+'</p><p class="muted">'+n+' votos</p><button class="btn btn-dark btn-small" data-group-vote="'+c.id+'" '+(myVote.data?'disabled':'')+'>Votar</button></article>'}).join(''):'<div class="empty">Todavía no hay propuestas aprobadas para votar.</div>')+'</div>';
 $$('[data-group-vote]').forEach(b=>b.onclick=async()=>{const {error}=await db.rpc('cast_group_vote',{p_group_id:currentRoom,p_candidate_id:b.dataset.groupVote});if(error){toast(error.message);return}toast('¡Voto registrado!');renderGroupVotes()});
}
function createGroupModal(){
 modal('Crear grupo','<p class="muted">Elegí si cualquiera puede unirse o si querés protegerlo con contraseña.</p><form id="groupForm"><div class="field"><label>Nombre del grupo</label><input name="name" maxlength="60" required></div><div class="field"><label>Descripción (opcional)</label><textarea name="description" maxlength="300"></textarea></div><div class="field"><label>Privacidad</label><select name="visibility"><option value="public">Público · cualquiera puede unirse</option><option value="private">Privado · requiere contraseña</option></select></div><div class="field" id="createPasswordField"><label>Contraseña (solo para grupos privados)</label><input name="password" type="password" minlength="6" placeholder="Mínimo 6 caracteres"></div><div class="field"><label>Logo (URL de imagen, opcional)</label><input name="logo_url" type="url" placeholder="https://…"></div><button class="btn btn-dark">Crear grupo</button></form>');
 const form=$('#groupForm');form.elements.visibility.onchange=()=>$('#createPasswordField').classList.toggle('hidden',form.elements.visibility.value==='public');
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),visibility=String(f.get('visibility')),pass=String(f.get('password')||'');if(visibility==='private'&&pass.length<6){toast('La contraseña debe tener al menos 6 caracteres.');return}
 const {data,error}=await db.rpc('create_chat_group',{group_name:String(f.get('name')).trim(),group_description:String(f.get('description')||'').trim(),group_visibility:visibility,group_password_hash:visibility==='private'?await sha256(pass):null,group_logo_url:String(f.get('logo_url')||'').trim()||null});
 if(error){toast(error.message);return}closeModal();currentRoom=data;currentGroupTab='chat';toast('Grupo creado.');await renderGroups()};
}
function joinGroupModal(){
 modal('Unirme a un grupo privado','<p class="muted">Ingresá el nombre exacto del grupo y su contraseña.</p><form id="joinForm"><div class="field"><label>Nombre del grupo</label><input name="name" required maxlength="60"></div><div class="field"><label>Contraseña</label><input name="password" type="password" required></div><button class="btn btn-dark">Unirme</button></form>');
 $('#joinForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),password_hash=await sha256(String(f.get('password')));const {data,error}=await db.rpc('join_chat_group',{group_name:String(f.get('name')).trim(),group_password_hash:password_hash});if(error){toast('No se pudo unir: '+error.message);return}closeModal();currentRoom=data;currentGroupTab='chat';toast('¡Ya sos parte del grupo!');await renderGroups()};
}
async function ownerGroupSettings(){
 const room=rooms.find(r=>r.id===currentRoom);if(!room||room.created_by!==user.id){toast('Solo el dueño puede configurar este grupo.');return}
 const {data:members,error}=await db.from('group_members').select('user_id,profiles(display_name)').eq('group_id',room.id);
 if(error){toast('No se pudieron cargar integrantes: '+error.message);return}
 const perms=room.member_permissions||{chat:true,vote:true,candidates:true};
 const rows=(members||[]).map(m=>'<div class="list-item row"><b>'+escapeHTML(m.profiles?.display_name||'Estudiante')+'</b>'+(m.user_id===user.id?'<span class="pill">Dueño</span>':'<button class="btn btn-light btn-small danger" data-remove-member="'+m.user_id+'">Quitar</button>')+'</div>').join('');
 modal('Configuración del grupo','<p class="muted">Administrá la identidad, privacidad, integrantes y permisos.</p><form id="ownerGroupForm"><div class="field"><label>Nombre</label><input name="name" maxlength="60" required value="'+escapeHTML(room.name)+'"></div><div class="field"><label>Descripción</label><textarea name="description" maxlength="300">'+escapeHTML(room.description||'')+'</textarea></div><div class="field"><label>Privacidad</label><select name="visibility"><option value="public" '+(room.visibility==='public'?'selected':'')+'>Público</option><option value="private" '+(room.visibility==='private'?'selected':'')+'>Privado con contraseña</option></select></div><div class="field"><label>Nueva contraseña (opcional)</label><input name="password" type="password" minlength="6" placeholder="Dejá vacío para conservar la actual"></div><div class="field"><label>Logo (URL)</label><input name="logo_url" type="url" value="'+escapeHTML(room.logo_url||'')+'"></div><h3>Permisos de integrantes</h3><label class="permission-line"><input type="checkbox" name="chat" '+(perms.chat!==false?'checked':'')+'> Pueden enviar mensajes</label><label class="permission-line"><input type="checkbox" name="vote" '+(perms.vote!==false?'checked':'')+'> Pueden votar</label><label class="permission-line"><input type="checkbox" name="candidates" '+(perms.candidates!==false?'checked':'')+'> Pueden proponer candidatos</label><button class="btn btn-dark" type="submit">Guardar configuración</button></form><h3 style="margin-top:20px">Integrantes ('+members.length+')</h3>'+(rows||'<p class="muted">Sin integrantes.</p>')+'<div class="settings-section"><button class="btn btn-light danger" id="deleteOwnedGroup">Eliminar grupo definitivamente</button></div>');
 $('#ownerGroupForm').onsubmit=async e=>{e.preventDefault();const f=e.target,pass=f.elements.password.value,visibility=f.elements.visibility.value;if(visibility==='private'&&room.visibility!=='private'&&!pass){toast('Para hacerlo privado, definí una contraseña.');return}const {error}=await db.rpc('owner_update_group',{p_group_id:room.id,p_name:f.elements.name.value.trim(),p_description:f.elements.description.value.trim(),p_password_hash:pass?await sha256(pass):null,p_visibility:visibility,p_logo_url:f.elements.logo_url.value.trim()||null,p_member_permissions:{chat:f.elements.chat.checked,vote:f.elements.vote.checked,candidates:f.elements.candidates.checked}});if(error){toast(error.message);return}closeModal();toast('Configuración guardada.');await renderGroups()};
 $$('[data-remove-member]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Quitar a este integrante?'))return;const {error}=await db.rpc('owner_remove_group_member',{p_group_id:room.id,p_user_id:b.dataset.removeMember});if(error){toast(error.message);return}toast('Integrante quitado.');ownerGroupSettings()});
 $('#deleteOwnedGroup').onclick=async()=>{if(!confirm('¿Eliminar definitivamente el grupo y sus mensajes?'))return;const {error}=await db.rpc('owner_delete_group',{p_group_id:room.id});if(error){toast(error.message);return}currentRoom=null;closeModal();toast('Grupo eliminado.');await renderGroups()};
}

async function renderRoomMessages(refreshOnly=false){
 const room=rooms.find(r=>r.id===currentRoom);if(!room)return;
 const host=$('#roomContent');if(!host)return;
 if(!refreshOnly)host.innerHTML=`<div class="row"><div><h3>Chat</h3><p class="muted">Conversación del grupo.</p></div></div>
 <div id="messages" class="message-list"><div class="loading">Cargando mensajes…</div></div>
 <form id="messageForm" class="chat-composer">
  <div class="composer-tools">
   <label class="attach-btn" title="Enviar fotos"><input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>📷</label>
   <label class="attach-btn" title="Adjuntar audio"><input id="audioInput" type="file" accept="audio/*" hidden>🎵</label>
   <label class="attach-btn" title="Enviar archivos"><input id="fileInput" type="file" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip" hidden>📎</label>
   <button type="button" class="attach-btn" id="recordBtn" title="Grabar audio">🎙️</button>
   <span id="recordStatus" class="record-status" aria-live="polite"></span>
  </div>
  <div class="composer-row"><input name="body" maxlength="1000" placeholder="Escribí un mensaje…" autocomplete="off"><button class="btn btn-dark" type="submit">Enviar ➤</button></div>
  <p class="muted composer-hint">Fotos, audios y documentos · Máximo 20 MB por archivo</p>
 </form>`;
 
 const list=$('#messages');
 const {data,error}=await db.from('messages').select('id,group_id,user_id,body,created_at,attachment_path,attachment_name,attachment_type,attachment_size,message_type,profiles(display_name)').eq('group_id',currentRoom).order('created_at',{ascending:true}).limit(100);
 if(error){list.innerHTML=`<p class="muted">${escapeHTML(error.message)}</p>`;return}
 const readKey=`vse-read-${user.id}-${currentRoom}`;let previousRead=0;try{previousRead=Number(localStorage.getItem(readKey)||0)}catch(e){}let unreadDividerShown=false;
 const rendered=await Promise.all((data||[]).map(async m=>{
  let attachment='';
  if(m.attachment_path){
   const {data:signed,error:signError}=await db.storage.from('chat-attachments').createSignedUrl(m.attachment_path,3600);
   if(!signError&&signed?.signedUrl){
    const url=escapeHTML(signed.signedUrl),name=escapeHTML(m.attachment_name||'Archivo'),type=m.attachment_type||'';
    if(type.startsWith('image/'))attachment=`<a class="attachment-image" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${name}" loading="lazy"></a>`;
    else if(type.startsWith('audio/'))attachment=`<div class="attachment-audio">🎧 <span>${name}</span><audio controls preload="none" src="${url}"></audio></div>`;
    else attachment=`<a class="attachment-file" href="${url}" target="_blank" rel="noopener" download="${name}">📄 <span>${name}</span> <small>${formatBytes(m.attachment_size)}</small> ↧</a>`;
   }else attachment='<small class="muted">Adjunto no disponible</small>';
  }
  const showUnread=!unreadDividerShown&&previousRead>0&&m.user_id!==user.id&&new Date(m.created_at).getTime()>previousRead;if(showUnread)unreadDividerShown=true;
  return `${showUnread?'<div class="unread-divider">Mensajes nuevos</div>':''}<div class="message ${m.user_id===user.id?'mine':''}"><b>${escapeHTML(m.profiles?.display_name||'Estudiante')}</b>${m.body?`<div class="message-body">${escapeHTML(m.body)}</div>`:''}${attachment}<small>${new Date(m.created_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}</small></div>`;
 }));
 list.innerHTML=rendered.length?rendered.join(''):'<div class="empty">Todavía no hay mensajes. ¡Saludá al grupo!</div>';list.scrollTop=list.scrollHeight;try{localStorage.setItem(readKey,String(Date.now()))}catch(e){}
 if(refreshOnly)return;
 const form=$('#messageForm'),bodyInput=form.elements.body;
 async function sendAttachment(file,kind){
  if(!file)return;
  const activeRoom=rooms.find(r=>r.id===currentRoom);if(activeRoom?.member_permissions?.chat===false&&activeRoom.created_by!==user.id){toast('El dueño desactivó el chat para integrantes.');return}
  if(file.size>20*1024*1024){toast('El archivo supera el límite de 20 MB.');return}
  const allowed=kind==='image'?['image/jpeg','image/png','image/webp','image/gif']:kind==='audio'?['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/aac','audio/x-wav','audio/flac','audio/3gpp','audio/x-m4a']:['application/pdf','text/plain','text/csv','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'];
  if(!allowed.includes(file.type)){toast('Ese formato no está permitido.');return}
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'archivo';
  const path=`${currentRoom}/${user.id}/${crypto.randomUUID()}-${safeName}`;
  toast('Subiendo archivo…');
  const {error:uploadError}=await db.storage.from('chat-attachments').upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError){toast('No se pudo subir: '+uploadError.message);return}
  const {error:insertError}=await db.from('messages').insert({group_id:currentRoom,user_id:user.id,body:'',attachment_path:path,attachment_name:file.name,attachment_type:file.type,attachment_size:file.size,message_type:kind});
  if(insertError){await db.storage.from('chat-attachments').remove([path]);toast('No se pudo enviar: '+insertError.message);return}
  toast('Archivo enviado.');await renderRoomMessages();
 }
 $('#imageInput').onchange=e=>sendAttachment(e.target.files[0],'image');
 $('#audioInput').onchange=e=>sendAttachment(e.target.files[0],'audio');
 $('#fileInput').onchange=e=>sendAttachment(e.target.files[0],'file');
 form.onsubmit=async e=>{e.preventDefault();const activeRoom=rooms.find(r=>r.id===currentRoom);if(activeRoom?.member_permissions?.chat===false&&activeRoom.created_by!==user.id){toast('El dueño desactivó el chat para integrantes.');return}const body=bodyInput.value.trim();if(!body)return;const {error}=await db.from('messages').insert({group_id:currentRoom,user_id:user.id,body,message_type:'text'});if(error){toast(error.message);return}bodyInput.value='';await renderRoomMessages()};
 let recorder=null,chunks=[],recordingStream=null;
 $('#recordBtn').onclick=async()=>{
  const btn=$('#recordBtn'),status=$('#recordStatus');
  if(recorder&&recorder.state==='recording'){recorder.stop();btn.textContent='🎙️';status.textContent='Procesando audio…';return}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Tu navegador no permite grabar audio. Podés adjuntar un audio existente.');return}
  try{
   recordingStream=await navigator.mediaDevices.getUserMedia({audio:true});
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
   recorder=new MediaRecorder(recordingStream,mime?{mimeType:mime}:{});
   chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   recorder.onstop=async()=>{recordingStream?.getTracks().forEach(t=>t.stop());recordingStream=null;const rawBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});const normalizedType=(rawBlob.type||'audio/webm').split(';')[0];const blob=new Blob([rawBlob],{type:normalizedType});const ext=normalizedType.includes('mp4')?'m4a':'webm';const audioFile=new File([blob],`audio-${Date.now()}.${ext}`,{type:normalizedType});status.textContent='';await sendAttachment(audioFile,'audio')};
   recorder.start();btn.textContent='⏹️';status.textContent='Grabando… Tocá para detener';
  }catch(err){toast('No se pudo acceder al micrófono. Revisá los permisos del navegador.');status.textContent=''}
 };
 if(window.roomChannelRoom!==currentRoom){
  if(window.roomChannel)db.removeChannel(window.roomChannel);
  const subscribedRoom=currentRoom;
  window.roomChannelRoom=subscribedRoom;
  window.roomChannel=db.channel('room-'+subscribedRoom).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'group_id=eq.'+subscribedRoom},()=>{if(currentRoom===subscribedRoom)renderRoomMessages(true)}).subscribe();
 }
}
function formatBytes(bytes){if(!bytes)return '';if(bytes<1024)return bytes+' B';if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';return (bytes/1048576).toFixed(1)+' MB'}
async function renderAdmin(sequence){
 const [cs,users,results,groups,messages,voting]=await Promise.all([
  db.from('candidates').select('id,title,status,user_id,created_at,profiles(display_name)').order('created_at',{ascending:false}),
  db.from('profiles').select('user_id,display_name,role,suspended,created_at').order('created_at',{ascending:false}),
  db.rpc('public_vote_results'),
  db.from('chat_groups').select('id,name,description,created_by,created_at,profiles:profiles!chat_groups_created_by_fkey(display_name)').order('created_at',{ascending:false}),
  db.from('messages').select('id,body,group_id,user_id,created_at,chat_groups(name),profiles(display_name)').order('created_at',{ascending:false}).limit(50),
  db.from('platform_settings').select('voting_open').eq('id',true).maybeSingle()
 ]);
 if(sequence&&sequence!==renderSequence)return;
 const errors=[cs,users,results,groups,messages,voting].find(x=>x.error);
 if(errors){$('#main').innerHTML=`${titleBlock('Administración','No se pudieron cargar todos los datos.')}<div class="panel-card">${escapeHTML(errors.error.message)}</div>`;return}
 const totalVotes=(results.data||[]).reduce((sum,row)=>sum+Number(row.vote_count||0),0);
 $('#main').innerHTML=`${titleBlock('Administración','Panel de control de la plataforma. Las acciones quedan protegidas por permisos del servidor.')}
 <div class="admin-grid"><div class="stat"><strong>${users.data.length}</strong><span>Perfiles</span></div><div class="stat"><strong>${cs.data.length}</strong><span>Propuestas</span></div><div class="stat"><strong>${totalVotes}</strong><span>Votos emitidos</span></div></div>
 <section class="panel-card" style="margin-top:18px"><div class="row"><div><h3>Votaciones</h3><p class="muted">Controlá si los estudiantes pueden emitir votos.</p></div><span class="pill">${voting.data?.voting_open===false?'Cerrada':'Abierta'}</span></div><div class="row" style="margin-top:12px"><button class="btn btn-dark btn-small" id="toggleVoting">${voting.data?.voting_open===false?'Abrir votación':'Cerrar votación'}</button><button class="btn btn-light btn-small danger" id="resetVotes">Reiniciar todos los votos</button></div></section>
 <section class="panel-card" style="margin-top:18px"><h3>Resultados por propuesta</h3>${cs.data.filter(c=>c.status==='approved').map(c=>{const v=(results.data||[]).find(x=>x.candidate_id===c.id);return '<div class="list-item row"><b>'+escapeHTML(c.title)+'</b><span class="pill">'+Number(v?.vote_count||0)+' votos</span></div>'}).join('')||'<p class="muted">Todavía no hay propuestas aprobadas.</p>'}</section>
 <section class="panel-card" style="margin-top:18px"><h3>Usuarios</h3><p class="muted">Consultá perfiles y suspendé o rehabilitá cuentas. No se puede cambiar el único administrador.</p>${users.data.map(u=>`<div class="list-item"><div class="row"><div><b>${escapeHTML(u.display_name)}</b><p>${u.role==='admin'?'Administración':'Estudiante'} · ${dateLabel(u.created_at)}</p></div><div>${u.role==='admin'?'<span class="pill">Admin único</span>':`<button class="btn btn-small ${u.suspended?'btn-light':'btn-dark'}" data-suspend="${u.user_id}" data-next="${!u.suspended}">${u.suspended?'Rehabilitar':'Suspender'}</button>`}</div></div></div>`).join('')}</section>
 <section class="panel-card" style="margin-top:18px"><h3>Propuestas y candidatos</h3>${cs.data.map(c=>`<div class="list-item"><div class="row"><div><b>${escapeHTML(c.title)}</b><p>Por ${escapeHTML(c.profiles?.display_name||'Estudiante')} · ${c.status}</p></div><div class="row"><button class="btn btn-light btn-small" data-status="${c.id}" data-next="approved">Aprobar</button><button class="btn btn-light btn-small danger" data-status="${c.id}" data-next="rejected">Rechazar</button></div></div></div>`).join('')||'<p class="muted">No hay propuestas.</p>'}</section>
 <section class="panel-card" style="margin-top:18px"><h3>Grupos</h3>${groups.data.map(g=>`<div class="list-item"><div class="row"><div><b>${escapeHTML(g.name)}</b><p>Dueño: ${escapeHTML(g.profiles?.display_name||'Estudiante')}</p></div><button class="btn btn-light btn-small danger" data-admin-group-delete="${g.id}">Eliminar grupo</button></div></div>`).join('')||'<p class="muted">No hay grupos.</p>'}</section>
 <section class="panel-card" style="margin-top:18px"><h3>Mensajes recientes</h3>${messages.data.map(m=>`<div class="list-item"><div class="row"><div><b>${escapeHTML(m.profiles?.display_name||'Estudiante')} · ${escapeHTML(m.chat_groups?.name||'Grupo')}</b><p>${escapeHTML(m.body||'Adjunto multimedia')} · ${new Date(m.created_at).toLocaleString('es-AR')}</p></div><button class="btn btn-light btn-small danger" data-admin-message-delete="${m.id}">Eliminar</button></div></div>`).join('')||'<p class="muted">No hay mensajes.</p>'}</section>
 <div style="margin-top:18px"><button class="btn btn-light" id="refreshAdmin">Actualizar panel</button></div>`;
 $('#resetVotes').onclick=async()=>{if(!confirm('¿Reiniciar todos los votos? Se borrará el recuento actual y no se puede deshacer.'))return;const {error}=await db.rpc('admin_reset_votes');if(error){toast(error.message);return}toast('Votos reiniciados.');renderAdmin()};
 $('#toggleVoting').onclick=async()=>{const {error}=await db.rpc('admin_set_voting_open',{p_open:voting.data?.voting_open===false});if(error){toast(error.message);return}toast('Estado de votación actualizado.');renderAdmin()};
 $$('[data-suspend]').forEach(b=>b.onclick=async()=>{const {error}=await db.rpc('admin_set_user_suspended',{p_user_id:b.dataset.suspend,p_suspended:b.dataset.next==='true'});if(error){toast(error.message);return}toast('Estado de cuenta actualizado.');renderAdmin()});
 $$('[data-status]').forEach(b=>b.onclick=async()=>{const {error}=await db.rpc('admin_set_candidate_status',{p_candidate_id:b.dataset.status,p_status:b.dataset.next});if(error){toast(error.message);return}toast('Propuesta actualizada.');renderAdmin()});
 $$('[data-admin-group-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este grupo y sus mensajes? Esta acción no se puede deshacer.'))return;const {error}=await db.rpc('admin_delete_group',{p_group_id:b.dataset.adminGroupDelete});if(error){toast(error.message);return}toast('Grupo eliminado.');renderAdmin()});
 $$('[data-admin-message-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este mensaje?'))return;const {error}=await db.rpc('admin_delete_message',{p_message_id:b.dataset.adminMessageDelete});if(error){toast(error.message);return}toast('Mensaje eliminado.');renderAdmin()});
 $('#refreshAdmin').onclick=()=>renderAdmin();
}
async function moderateCandidate(id,status){const {error}=await db.from('candidates').update({status}).eq('id',id);if(error){toast(error.message);return}toast(status==='approved'?'Proyecto aprobado.':'Proyecto rechazado.');renderAdmin()}

function base64UrlToBytes(value){
 const padding='='.repeat((4-value.length%4)%4);
 const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function pushFunctionRequest(method,body){
 const result=await db.auth.getSession();
 const session=result.data.session;
 if(!session||!session.access_token)throw new Error('Iniciá sesión primero.');
 const response=await fetch(CONFIG.url+'/functions/v1/send-push',{
  method:method,
  headers:{'Content-Type':'application/json','apikey':CONFIG.anonKey,'Authorization':'Bearer '+session.access_token},
  body:body?JSON.stringify(body):undefined
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'No se pudo conectar con notificaciones.');
 return data;
}
async function enablePush(){
 if(!user){authModal('login');return}
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){toast('Este navegador no admite notificaciones push.');return}
 if(!window.isSecureContext){toast('Las notificaciones necesitan HTTPS.');return}
 try{
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){toast('No diste permiso para las notificaciones.');return}
  const registration=await (window.vseServiceWorker||navigator.serviceWorker.register('/sw.js'));
  const config=await pushFunctionRequest('GET');
  const existing=await registration.pushManager.getSubscription();
  const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToBytes(config.publicKey)});
  const data=subscription.toJSON();
  if(!data.keys||!data.keys.p256dh||!data.keys.auth)throw new Error('El navegador no entregó las claves de la suscripción.');
  const prior=await db.from('push_subscriptions').select('id').eq('user_id',user.id).eq('endpoint',data.endpoint).maybeSingle();
  if(prior.error)throw prior.error;
  if(!prior.data){const saved=await db.from('push_subscriptions').insert({user_id:user.id,endpoint:data.endpoint,p256dh:data.keys.p256dh,auth:data.keys.auth});if(saved.error)throw saved.error;}
  toast('¡Notificaciones activadas!');
  notificationsModal();
 }catch(error){console.error(error);toast(error.message||'No se pudieron activar las notificaciones.')}
}
async function disablePush(){
 if(!user)return;
 try{
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if(subscription){
   const removed=await db.from('push_subscriptions').delete().eq('endpoint',subscription.endpoint).eq('user_id',user.id);
   if(removed.error)throw removed.error;
   await subscription.unsubscribe();
  }
  toast('Notificaciones desactivadas.');
  notificationsModal();
 }catch(error){console.error(error);toast(error.message||'No se pudieron desactivar.')}
}
async function notificationsModal(){
 if(!user){authModal('login');return}
 let subscribed=false;
 try{
  const registration=await navigator.serviceWorker.ready;
  subscribed=Boolean(await registration.pushManager.getSubscription());
 }catch(e){}
 const supported=('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
 const permission=('Notification'in window)?Notification.permission:'unsupported';
 const status=!supported?'No compatible':subscribed?'Activadas':permission==='denied'?'Bloqueadas en el navegador':'Desactivadas';
 const detail=permission==='denied'?'Permití las notificaciones desde la configuración del navegador para poder activarlas.':'Podés cambiar esta opción cuando quieras.';
 const action=subscribed?'<button class="btn btn-light" id="disablePushBtn">Desactivar notificaciones</button>':'<button class="btn btn-dark" id="enablePushBtn" '+(!supported||permission==='denied'?'disabled':'')+'>Activar notificaciones</button>';
 modal('Notificaciones','<p class="muted">Recibí avisos de mensajes en tus grupos y novedades de tus proyectos, incluso cuando no tengas abierta la página.</p><div class="panel-card"><b>Estado: '+status+'</b><p class="muted">'+detail+'</p></div>'+action);
 $('#enablePushBtn')?.addEventListener('click',enablePush);
 $('#disablePushBtn')?.addEventListener('click',disablePush);
}

function settingsModal(){
 if(!user){modal('Configuración','<p class="muted">Iniciá sesión para administrar tu perfil y tus preferencias.</p><button id="loginSettings" class="btn btn-dark">Ingresar</button>');$('#loginSettings')?.addEventListener('click',()=>authModal('login'));return}
 const displayName=escapeHTML(profile?.display_name||'');
 const language=profile?.language||'es';
 modal('Configuración',`
  <section class="settings-section"><h3>Mi perfil</h3><p class="muted">Este nombre es el que ven tus compañeros en los grupos y proyectos.</p>
   <form id="profileSettingsForm"><div class="field"><label for="settingsDisplayName">Nombre para mostrar</label><input id="settingsDisplayName" name="display_name" maxlength="60" minlength="1" value="${displayName}" required></div><button class="btn btn-dark" type="submit">Guardar nombre</button></form>
  </section>
  <section class="settings-section"><h3>Seguridad</h3><form id="passwordSettingsForm"><div class="field"><label for="settingsPassword">Nueva contraseña</label><input id="settingsPassword" name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required placeholder="Mínimo 8 caracteres"></div><button class="btn btn-light" type="submit">Cambiar contraseña</button></form></section>
  <section class="settings-section"><h3>Idioma</h3><div class="field"><label for="settingsLanguage">Idioma de la cuenta</label><select id="settingsLanguage"><option value="es" ${language==='es'?'selected':''}>Español</option><option value="en" ${language==='en'?'selected':''}>English</option></select></div><button id="saveLanguage" class="btn btn-light" type="button">Guardar idioma</button><p class="muted">La preferencia se guarda en tu cuenta; la traducción completa de la interfaz todavía está pendiente.</p></section>
  <section class="settings-section"><h3>Notificaciones</h3><p class="muted">Administrá los avisos de mensajes y novedades.</p><button id="settingsNotifications" class="btn btn-light" type="button">Administrar notificaciones 🔔</button></section>
  <section class="settings-section"><p class="muted">Tipo de cuenta: <b>${escapeHTML(profile?.role==='admin'?'Administración':'Estudiante')}</b></p><button id="logoutSettings" class="btn btn-light danger" type="button">Cerrar sesión</button></section>`);
 $('#profileSettingsForm').onsubmit=async e=>{
  e.preventDefault();const name=String(new FormData(e.target).get('display_name')||'').trim();
  if(!name||name.length>60){toast('El nombre debe tener entre 1 y 60 caracteres.');return}
  const {error}=await db.from('profiles').update({display_name:name}).eq('user_id',user.id);
  if(error){console.error(error);toast('No se pudo guardar el nombre: '+error.message);return}
  const meta=await db.auth.updateUser({data:{display_name:name}});
  if(meta.error)console.warn('Profile metadata update failed',meta.error);
  await refreshUser();toast('Nombre actualizado correctamente.');settingsModal();
 };
 $('#passwordSettingsForm').onsubmit=async e=>{
  e.preventDefault();const password=String(new FormData(e.target).get('password')||'');
  if(password.length<8||password.length>72){toast('La contraseña debe tener entre 8 y 72 caracteres.');return}
  const {error}=await db.auth.updateUser({password});
  if(error){console.error(error);toast('No se pudo cambiar la contraseña: '+error.message);return}
  e.target.reset();toast('Contraseña actualizada correctamente.');
 };
 $('#saveLanguage').onclick=async()=>{const value=$('#settingsLanguage').value;const {error}=await db.rpc('update_account_language',{p_language:value});if(error){toast(error.message);return}profile.language=value;toast('Idioma guardado.');settingsModal()};
 $('#settingsNotifications').onclick=()=>notificationsModal();
 $('#logoutSettings').onclick=logout;
}
async function logout(){await db.auth.signOut();user=null;profile=null;currentRoom=null;if(window.roomChannel){db.removeChannel(window.roomChannel);window.roomChannel=null;window.roomChannelRoom=null}renderAuthUI();closeModal();toast('Sesión cerrada.');go('inicio')}
document.addEventListener('click',e=>{const goBtn=e.target.closest('[data-go]');if(goBtn)go(goBtn.dataset.go);const nav=e.target.closest('[data-view]');if(nav)go(nav.dataset.view);const voteBtn=e.target.closest('[data-vote]');if(voteBtn)vote(voteBtn.dataset.vote)});
$('#settingsBtn').onclick=settingsModal;$('#notificationsBtn').onclick=notificationsModal;$('#authBtn').onclick=()=>user?logout():authModal('login');
async function boot(){if('serviceWorker'in navigator){window.vseServiceWorker=navigator.serviceWorker.register('/sw.js').catch(error=>{console.warn('Service worker unavailable',error);return null})}if(!configured()){$('#connectionLabel').textContent='Falta configurar';renderView();return}db=window.supabase.createClient(CONFIG.url,CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});try{await refreshUser();$('#connectionLabel').textContent='Supabase conectado';$('.dot')?.classList.add('online');db.auth.onAuthStateChange(()=>{setTimeout(async()=>{await refreshUser();if(!user&&window.roomChannel){db.removeChannel(window.roomChannel);window.roomChannel=null;window.roomChannelRoom=null}await renderView()},0)});await renderView();if(location.hash)handleHashRoute()}catch(e){console.error(e);$('#connectionLabel').textContent='Error de conexión';toast('No se pudo conectar con Supabase. Revisá la configuración.')}}
boot();
