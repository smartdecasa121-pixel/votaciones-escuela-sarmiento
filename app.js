/* Votaciones Escuela Sarmiento — cliente Supabase. No colocar service_role key en el navegador. */
const CONFIG={url:'https://fcibtyumzxuthnjecwpv.supabase.co',anonKey:'sb_publishable_inO7chZ4QFHLbKm5JsMpoQ_vZ4p8NGu'};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let db=null,user=null,profile=null,currentView='inicio',currentRoom=null,rooms=[];
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
async function refreshUser(){const {data:{user:u}}=await db.auth.getUser();user=u;profile=null;if(user){const r=await db.from('profiles').select('user_id,display_name,role,created_at').eq('user_id',user.id).maybeSingle();if(r.error)console.warn(r.error);profile=r.data||{user_id:user.id,display_name:user.user_metadata?.display_name||user.email,role:'student'}}renderAuthUI()}
function renderAuthUI(){$('#userBadge').textContent=user?(profile?.display_name||user.email):'Invitado';$('#authBtn').textContent=user?'Salir':'Ingresar';$$('.admin-only').forEach(x=>x.classList.toggle('hidden',profile?.role!=='admin'))}
let renderSequence=0;
function go(view){
 const allowed=['inicio','mensajes','votaciones','candidatos','grupos','admin'];
 if(!allowed.includes(view))view='inicio';
 currentView=view;
 $('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 try{history.replaceState(null,'','#'+view)}catch(e){}
 renderView();
}
function handleHashRoute(){const view=location.hash.replace(/^#/,'');if(['inicio','mensajes','votaciones','candidatos','grupos','admin'].includes(view))go(view)}
window.addEventListener('hashchange',handleHashRoute);
function titleBlock(title,desc,action=''){return `<div class="page-title"><div><p class="eyebrow">ESCUELA SARMIENTO</p><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function projectCard(c){return `<article class="project-card"><div class="emoji">💡</div><span class="pill">${c.status==='approved'?'Candidato/a':c.status==='pending'?'En revisión':'Proyecto'}</span><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p><div class="meta">Propuesto por ${escapeHTML(c.display_name||'Estudiante')} · ${dateLabel(c.created_at)}</div>${c.status==='approved'?`<button class="btn btn-light btn-small" data-vote="${c.id}">Votar por este proyecto →</button>`:''}</article>`}
async function getCandidates(approvedOnly=true){if(!db)return[];let q=db.from('candidates').select('id,user_id,title,description,status,created_at,start_date,end_date,profiles(display_name)').order('created_at',{ascending:false});if(approvedOnly)q=q.eq('status','approved');const {data,error}=await q;if(error){console.error(error);return[]}return(data||[]).map(c=>({...c,display_name:c.profiles?.display_name||'Estudiante'}))}
async function renderView(){const sequence=++renderSequence;const main=$('#main');if(!configured()){main.innerHTML=`${titleBlock('Conectemos la escuela','Antes de usar la plataforma, configurá Supabase.')}<div class="panel-card"><h3>Falta la configuración de Supabase</h3><p>En el archivo <code>app.js</code>, completá <code>CONFIG.url</code> y <code>CONFIG.anonKey</code> con la URL del proyecto y la clave publicable (anon) de Supabase. Nunca uses la clave <code>service_role</code> en el navegador.</p><p>Después subí los archivos a GitHub y desplegá en Vercel siguiendo <code>README.md</code>.</p></div>`;return}
 if(currentView==='inicio'){const cs=await getCandidates();if(sequence!==renderSequence)return;main.innerHTML=`<section class="hero"><div><p class="eyebrow">PARTICIPÁ · PROPONÉ · VOTÁ</p><h1>Tu escuela,<br><span>tu voz.</span></h1><p class="hero-copy">Un espacio para compartir ideas, conocer proyectos y participar de las votaciones de la Escuela Sarmiento.</p><div class="hero-actions"><button class="btn btn-dark" data-go="candidatos">Conocer proyectos →</button><button class="btn btn-light" data-go="votaciones">Ir a votar</button></div></div><div class="hero-art"><div class="sun"></div><div class="art-card card-one">💡<b>Ideas</b><small>que mejoran la escuela</small></div><div class="art-card card-two">✋<b>Tu voto</b><small>hace la diferencia</small></div><div class="art-star">✦</div></div></section><section class="section-head"><div><p class="eyebrow">EL TABLERO</p><h2>Proyectos destacados</h2></div><button class="text-btn" data-go="candidatos">Ver todos →</button></section><div class="cards-grid">${cs.length?cs.slice(0,3).map(projectCard).join(''):'<div class="empty">Todavía no hay proyectos aprobados. Ingresá y proponé el primero.</div>'}</div><div class="notice"><span>💛</span><div><b>Un acuerdo para convivir mejor</b><p>Respetamos las ideas de los demás, cuidamos nuestros mensajes y participamos con responsabilidad.</p></div></div><footer>Votaciones Escuela Sarmiento · Proyecto escolar</footer>`;return}
 if(currentView==='candidatos'){const cs=await getCandidates(false);if(sequence!==renderSequence)return;main.innerHTML=`${titleBlock('Candidatos y proyectos','Conocé las propuestas de tus compañeros.',user?'<button class="btn btn-dark" id="newCandidate">＋ Proponer proyecto</button>':'<button class="btn btn-dark" id="loginPrompt">Ingresar para proponer</button>')}<div class="cards-grid">${cs.length?cs.map(projectCard).join(''):'<div class="empty">Todavía no hay propuestas. ¡Podés ser el primero en compartir una idea!</div>'}</div>`;$('#newCandidate')?.addEventListener('click',candidateModal);$('#loginPrompt')?.addEventListener('click',()=>authModal('login'));return}
 if(currentView==='votaciones'){if(!user){main.innerHTML=`${titleBlock('Votaciones','Para emitir tu voto, primero tenés que ingresar.')}<div class="panel-card"><h3>Tu voz cuenta</h3><p>Ingresá con tu cuenta para ver los proyectos aprobados y emitir un único voto.</p><button class="btn btn-dark" id="voteLogin">Ingresar</button></div>`;$('#voteLogin').onclick=()=>authModal('login');return}const cs=await getCandidates();const {data:existing,error:voteReadError}=await db.from('votes').select('id,candidate_id,created_at').eq('user_id',user.id).maybeSingle();const results=await db.rpc('public_vote_results');if(sequence!==renderSequence)return;if(voteReadError||results.error){main.innerHTML=titleBlock('Votaciones','No se pudieron cargar los datos.')+'<div class="panel-card">'+escapeHTML(voteReadError?.message||results.error?.message||'Error desconocido')+'</div>';return}const counts=results.data||[];main.innerHTML=`${titleBlock('Votaciones','Cada estudiante puede emitir un solo voto. Pensá qué propuesta representa mejor al grupo.')}${existing?`<div class="notice"><span>✓</span><div><b>Tu voto ya fue registrado</b><p>La plataforma no permite volver a votar. Gracias por participar.</p></div></div>`:''}<div class="cards-grid">${cs.length?cs.map(c=>{const count=counts.find(x=>x.candidate_id===c.id)?.vote_count||0;return `<article class="project-card"><div class="emoji">✋</div><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p>${results.data?`<div class="meta">Votos: ${count}</div>`:''}<button class="btn ${existing?'btn-light':'btn-dark'} btn-small" data-vote="${c.id}" ${existing?'disabled':''}>${existing?'Voto emitido':'Votar por este proyecto'}</button></article>`}).join(''):'<div class="empty">No hay proyectos aprobados para votar todavía.</div>'}</div>`;return}
 if(currentView==='mensajes'){main.innerHTML=`${titleBlock('Mensajes','Conversá en los grupos de los que formás parte.')}<div class="panel-card"><p>Los mensajes se organizan por grupo. Entrá a Grupos para crear uno o unirte con su contraseña.</p><button class="btn btn-dark" data-go="grupos">Ir a grupos →</button></div>`;return}
 if(currentView==='grupos'){if(!user){main.innerHTML=`${titleBlock('Grupos','Creá espacios para organizar ideas y conversar.')}<div class="panel-card"><p>Ingresá para crear un grupo o unirte a uno con contraseña.</p><button class="btn btn-dark" id="groupsLogin">Ingresar</button></div>`;$('#groupsLogin').onclick=()=>authModal('login');return}await renderGroups();return}
 if(currentView==='admin'){if(profile?.role!=='admin'){main.innerHTML=`${titleBlock('Administración','Esta sección es solo para la cuenta administradora.')}<div class="panel-card">No tenés permisos para entrar acá.</div>`;return}await renderAdmin();return}
}
function candidateModal(){if(!needAuth())return;modal('Proponer un proyecto',`<p class="muted">Las propuestas quedan pendientes hasta que la persona administradora las apruebe. No incluyas teléfonos, correos ni datos personales.</p><form id="candidateForm"><div class="field"><label>Nombre del proyecto</label><input name="title" maxlength="100" required></div><div class="field"><label>¿En qué consiste?</label><textarea name="description" maxlength="1200" required></textarea></div><div class="two-col"><div class="field"><label>Fecha de inicio (opcional)</label><input name="start_date" type="date"></div><div class="field"><label>Fecha de cierre (opcional)</label><input name="end_date" type="date"></div></div><button class="btn btn-dark" type="submit">Enviar propuesta</button></form>`);$('#candidateForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const data={user_id:user.id,title:String(f.get('title')).trim(),description:String(f.get('description')).trim(),start_date:f.get('start_date')||null,end_date:f.get('end_date')||null,status:'pending'};if(data.start_date&&data.end_date&&data.end_date<data.start_date){toast('La fecha de cierre no puede ser anterior al inicio.');return}const {error}=await db.from('candidates').insert(data);if(error){toast(error.message);return}closeModal();toast('Propuesta enviada para revisión.');renderView()}}
async function vote(id){if(!needAuth())return;const {data,error}=await db.rpc('cast_vote',{candidate_uuid:id});if(error){toast(error.message.includes('already')||error.message.includes('duplicate')?'Ya emitiste tu voto.':error.message);return}toast('¡Voto registrado!');go('votaciones')}
async function sha256(s){const bytes=new TextEncoder().encode(s);const hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function renderGroups(){const {data:members,error}=await db.from('group_members').select('group_id,chat_groups(id,name,description,created_at,created_by)').eq('user_id',user.id);if(error){$('#main').innerHTML=`${titleBlock('Grupos','No se pudieron cargar los grupos.')}<div class="panel-card">${escapeHTML(error.message)}</div>`;return}rooms=(members||[]).map(x=>x.chat_groups).filter(Boolean);if(currentRoom&&!rooms.some(r=>r.id===currentRoom))currentRoom=null;if(!currentRoom&&rooms.length)currentRoom=rooms[0].id;$('#main').innerHTML=`${titleBlock('Grupos','Conversá con compañeros. Para unirte a un grupo necesitás su contraseña.', '<button class="btn btn-dark" id="createGroup">＋ Crear grupo</button>')}<div class="room-layout"><section class="panel-card room-list"><h3>Mis grupos</h3>${rooms.length?rooms.map(r=>`<button data-room="${r.id}" class="${r.id===currentRoom?'selected':''}">${escapeHTML(r.name)}</button>`).join(''):'<p class="muted">Todavía no estás en ningún grupo.</p>'}<button id="joinGroup" class="btn btn-light btn-small" style="margin-top:10px">＋ Unirme con contraseña</button></section><section class="panel-card" id="roomContent">${currentRoom?'<div class="loading">Cargando mensajes…</div>':'<div class="empty">Elegí un grupo o creá uno para empezar.</div>'}</section></div>`;$('#createGroup').onclick=createGroupModal;$('#joinGroup').onclick=joinGroupModal;$$('[data-room]').forEach(b=>b.onclick=()=>{currentRoom=b.dataset.room;renderGroups()});if(currentRoom)await renderRoomMessages()}
function createGroupModal(){modal('Crear grupo',`<p class="muted">La contraseña se guarda como hash, no como texto visible. Compartila solo con quienes quieras invitar.</p><form id="groupForm"><div class="field"><label>Nombre del grupo</label><input name="name" maxlength="60" required></div><div class="field"><label>Descripción (opcional)</label><textarea name="description" maxlength="300"></textarea></div><div class="field"><label>Contraseña del grupo (mínimo 6 caracteres)</label><input name="password" type="password" minlength="6" required></div><button class="btn btn-dark">Crear grupo</button></form>`);$('#groupForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')).trim(),description=String(f.get('description')||'').trim(),password_hash=await sha256(String(f.get('password')));const {data,error}=await db.rpc('create_chat_group',{group_name:name,group_description:description,group_password_hash:password_hash});if(error){toast(error.message);return}closeModal();currentRoom=data;toast('Grupo creado. ¡Compartí la contraseña con tus compañeros!');await renderGroups()}}
function joinGroupModal(){modal('Unirme a un grupo',`<p class="muted">Necesitás el nombre exacto del grupo y su contraseña.</p><form id="joinForm"><div class="field"><label>Nombre del grupo</label><input name="name" required maxlength="60"></div><div class="field"><label>Contraseña del grupo</label><input name="password" type="password" required></div><button class="btn btn-dark">Unirme</button></form>`);$('#joinForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),password_hash=await sha256(String(f.get('password')));const {data,error}=await db.rpc('join_chat_group',{group_name:String(f.get('name')).trim(),group_password_hash:password_hash});if(error){toast('No se pudo unir: revisá el nombre y la contraseña.');return}closeModal();currentRoom=data;toast('¡Ya sos parte del grupo!');await renderGroups()}}
async function renderRoomMessages(refreshOnly=false){
 const room=rooms.find(r=>r.id===currentRoom);if(!room)return;
 const host=$('#roomContent');if(!host)return;
 if(!refreshOnly)host.innerHTML=`<div class="row"><div><h3>${escapeHTML(room.name)}</h3><p class="muted">${escapeHTML(room.description||'Conversación del grupo')}</p></div><span class="pill">Grupo privado</span></div>
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
 form.onsubmit=async e=>{e.preventDefault();const body=bodyInput.value.trim();if(!body)return;const {error}=await db.from('messages').insert({group_id:currentRoom,user_id:user.id,body,message_type:'text'});if(error){toast(error.message);return}bodyInput.value='';await renderRoomMessages()};
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
async function renderAdmin(){
 const [cs,users,results]=await Promise.all([
  db.from('candidates').select('id,title,status,user_id,created_at,profiles(display_name)').order('created_at',{ascending:false}),
  db.from('profiles').select('user_id,display_name,role,created_at'),
  db.rpc('public_vote_results')
 ]);
 const totalVotes=(results.data||[]).reduce((sum,row)=>sum+Number(row.vote_count||0),0);
 if(cs.error||users.error||results.error){$('#main').innerHTML=`${titleBlock('Administración','No se pudieron cargar todos los datos.')}<div class="panel-card">${escapeHTML(cs.error?.message||users.error?.message||results.error?.message||'Error desconocido')}</div>`;return}
 $('#main').innerHTML=`${titleBlock('Administración','Revisá propuestas y consultá la actividad de la plataforma.')}<div class="admin-grid"><div class="stat"><strong>${users.data?.length||0}</strong><span>Perfiles</span></div><div class="stat"><strong>${cs.data?.length||0}</strong><span>Propuestas</span></div><div class="stat"><strong>${totalVotes}</strong><span>Votos emitidos</span></div></div><section class="panel-card" style="margin-top:18px"><h3>Propuestas pendientes</h3>${(cs.data||[]).filter(c=>c.status==='pending').map(c=>`<div class="list-item"><div class="row"><b>${escapeHTML(c.title)}</b><span class="pill">Pendiente</span></div><p>Por ${escapeHTML(c.profiles?.display_name||'Estudiante')}</p><div class="row"><button class="btn btn-dark btn-small" data-approve="${c.id}">Aprobar</button><button class="btn btn-light btn-small danger" data-reject="${c.id}">Rechazar</button></div></div>`).join('')||'<p class="muted">No hay propuestas pendientes.</p>'}</section><section class="panel-card" style="margin-top:18px"><h3>Estado de la votación</h3><p class="muted">Los resultados visibles para todos se muestran en la sección Votaciones. Los votos son únicos por cuenta.</p><button class="btn btn-light btn-small" id="refreshAdmin">Actualizar datos</button></section>`;
 $$('[data-approve]').forEach(b=>b.onclick=()=>moderateCandidate(b.dataset.approve,'approved'));
 $$('[data-reject]').forEach(b=>b.onclick=()=>moderateCandidate(b.dataset.reject,'rejected'));
 $('#refreshAdmin').onclick=renderAdmin;
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
 modal('Configuración',`
  <section class="settings-section"><h3>Mi perfil</h3><p class="muted">Este nombre es el que ven tus compañeros en los grupos y proyectos.</p>
   <form id="profileSettingsForm"><div class="field"><label for="settingsDisplayName">Nombre para mostrar</label><input id="settingsDisplayName" name="display_name" maxlength="60" minlength="1" value="${displayName}" required></div><button class="btn btn-dark" type="submit">Guardar nombre</button></form>
  </section>
  <section class="settings-section"><h3>Seguridad</h3><form id="passwordSettingsForm"><div class="field"><label for="settingsPassword">Nueva contraseña</label><input id="settingsPassword" name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required placeholder="Mínimo 8 caracteres"></div><button class="btn btn-light" type="submit">Cambiar contraseña</button></form></section>
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
 $('#settingsNotifications').onclick=()=>notificationsModal();
 $('#logoutSettings').onclick=logout;
}
async function logout(){await db.auth.signOut();user=null;profile=null;currentRoom=null;if(window.roomChannel){db.removeChannel(window.roomChannel);window.roomChannel=null;window.roomChannelRoom=null}renderAuthUI();closeModal();toast('Sesión cerrada.');go('inicio')}
document.addEventListener('click',e=>{const goBtn=e.target.closest('[data-go]');if(goBtn)go(goBtn.dataset.go);const nav=e.target.closest('[data-view]');if(nav)go(nav.dataset.view);const voteBtn=e.target.closest('[data-vote]');if(voteBtn)vote(voteBtn.dataset.vote)});
$('#settingsBtn').onclick=settingsModal;$('#notificationsBtn').onclick=notificationsModal;$('#authBtn').onclick=()=>user?logout():authModal('login');
async function boot(){if('serviceWorker'in navigator){window.vseServiceWorker=navigator.serviceWorker.register('/sw.js').catch(error=>{console.warn('Service worker unavailable',error);return null})}if(!configured()){$('#connectionLabel').textContent='Falta configurar';renderView();return}db=window.supabase.createClient(CONFIG.url,CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});try{await refreshUser();$('#connectionLabel').textContent='Supabase conectado';$('.dot')?.classList.add('online');db.auth.onAuthStateChange(()=>{setTimeout(async()=>{await refreshUser();if(!user&&window.roomChannel){db.removeChannel(window.roomChannel);window.roomChannel=null;window.roomChannelRoom=null}await renderView()},0)});await renderView();if(location.hash)handleHashRoute()}catch(e){console.error(e);$('#connectionLabel').textContent='Error de conexión';toast('No se pudo conectar con Supabase. Revisá la configuración.')}}
boot();
